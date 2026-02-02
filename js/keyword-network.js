/**
 * Interactive keyword network visualization using D3.js
 * Adapted for neobrutalist-hp site with warm orange/yellow gradient theme
 */

// Category colors matching the neobrutalist site theme
const CATEGORY_COLORS = {
  virology: '#e67e22',      // Orange
  microbiology: '#b8621b',  // Rust
  methods: '#f39c12',       // Amber
  environment: '#8b4513',   // Brown
  biothreat: '#f1c40f',     // Gold
  other: '#6b7280',         // Gray
};

// Category labels for legend
const CATEGORY_LABELS = {
  virology: 'Virology',
  microbiology: 'Microbiology',
  methods: 'Methods & Genomics',
  environment: 'Environment',
  biothreat: 'Biosecurity',
  other: 'Other Topics',
};

// Cluster centers for each category (will be calculated dynamically)
const CLUSTER_STRENGTH = 0.15;

let simulation = null;
let svg = null;
let networkData = null;
let currentEdgeThreshold = 10; // Minimum edge weight to display

/**
 * Initialize the keyword network visualization
 */
async function initKeywordNetwork() {
  const container = document.getElementById('network-container');
  if (!container) return;

  // Show loading state
  container.innerHTML = '<div class="network-loading">Loading research topics...</div>';

  try {
    // Fetch network data
    const response = await fetch('./data/keyword_network.json');
    if (!response.ok) throw new Error('Failed to load network data');
    const rawData = await response.json();

    // Filter and clean the data
    networkData = filterNetworkData(rawData);

    // Clear loading state
    container.innerHTML = '';

    // Create controls
    createControls(container);

    // Create SVG
    const width = container.clientWidth;
    const height = Math.max(600, window.innerHeight * 0.7);

    svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'keyword-network-svg');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Calculate cluster centers
    const categories = [...new Set(networkData.nodes.map(n => n.category))];
    const clusterCenters = {};
    const angleStep = (2 * Math.PI) / categories.length;
    const clusterRadius = Math.min(width, height) * 0.25;

    categories.forEach((cat, i) => {
      clusterCenters[cat] = {
        x: width / 2 + Math.cos(i * angleStep) * clusterRadius,
        y: height / 2 + Math.sin(i * angleStep) * clusterRadius
      };
    });

    // Filter edges by threshold
    const filteredEdges = networkData.edges.filter(e => e.weight >= currentEdgeThreshold);

    // Calculate edge weight range for scaling
    const edgeWeights = filteredEdges.map(e => e.weight);
    const minWeight = Math.min(...edgeWeights);
    const maxWeight = Math.max(...edgeWeights);

    // Scale for edge thickness (1-8 pixels)
    const edgeScale = d3.scaleLinear()
      .domain([minWeight, maxWeight])
      .range([1, 8]);

    // Scale for edge opacity (0.2-0.8)
    const opacityScale = d3.scaleLinear()
      .domain([minWeight, maxWeight])
      .range([0.15, 0.6]);

    // Create edges
    const edges = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(filteredEdges)
      .enter()
      .append('line')
      .attr('class', 'network-edge')
      .attr('stroke', d => {
        // Color based on source node category
        const sourceNode = networkData.nodes.find(n => n.id === (d.source.id || d.source));
        return CATEGORY_COLORS[sourceNode?.category] || '#e67e22';
      })
      .attr('stroke-width', d => edgeScale(d.weight))
      .attr('stroke-opacity', d => opacityScale(d.weight))
      .attr('stroke-linecap', 'round');

    // Create nodes
    const nodes = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(networkData.nodes)
      .enter()
      .append('g')
      .attr('class', 'network-node')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', d => Math.max(8, Math.min(35, d.size * 0.8)))
      .attr('fill', d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.other)
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Add labels to nodes
    nodes.append('text')
      .text(d => d.label)
      .attr('x', 0)
      .attr('y', d => -Math.max(8, Math.min(35, d.size * 0.8)) - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#1a1a1a')
      .attr('font-size', d => Math.max(10, Math.min(14, d.count / 5)))
      .attr('font-weight', d => d.count > 30 ? '600' : '400')
      .attr('opacity', d => d.count > 15 ? 1 : 0.7)
      .attr('class', 'node-label');

    // Add tooltips
    nodes.append('title')
      .text(d => `${d.label}\nMentioned in ${d.count} publications\nCategory: ${CATEGORY_LABELS[d.category] || 'Other'}`);

    // Click handler to highlight connections
    nodes.on('click', (event, d) => {
      event.stopPropagation();
      highlightConnections(d, nodes, edges);
    });

    // Click on background to reset
    svg.on('click', () => {
      resetHighlight(nodes, edges);
    });

    // Create force simulation
    simulation = d3.forceSimulation(networkData.nodes)
      .force('link', d3.forceLink(filteredEdges)
        .id(d => d.id)
        .distance(d => {
          const baseDistance = 100;
          const weightFactor = 1 - (d.weight - minWeight) / (maxWeight - minWeight);
          return baseDistance * (0.5 + weightFactor * 0.5);
        })
        .strength(d => {
          return 0.3 + (d.weight / maxWeight) * 0.5;
        }))
      .force('charge', d3.forceManyBody()
        .strength(-150)
        .distanceMax(250))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide().radius(d => d.size + 15).strength(0.8))
      // Category clustering force
      .force('cluster', alpha => {
        networkData.nodes.forEach(d => {
          const center = clusterCenters[d.category];
          if (center) {
            d.vx -= (d.x - center.x) * CLUSTER_STRENGTH * alpha;
            d.vy -= (d.y - center.y) * CLUSTER_STRENGTH * alpha;
          }
        });
      })
      .alphaDecay(0.05)
      .velocityDecay(0.6)
      .on('tick', () => {
        edges
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
      });

    // Create legend
    createLegend(container);

    // Add stats
    updateStats(filteredEdges.length);

    // Reset button
    document.getElementById('reset-network')?.addEventListener('click', () => {
      resetNetwork();
      resetHighlight(nodes, edges);
    });

  } catch (error) {
    console.error('Failed to initialize keyword network:', error);
    container.innerHTML = '<div class="network-error">Failed to load visualization. Please try again later.</div>';
  }
}

/**
 * Filter out noisy/meaningless keywords and weak edges
 */
function filterNetworkData(data) {
  const excludePhrases = new Set([
    'here we report', 'here we present', 'our findings', 'our knowledge',
    'more than', 'as well as', 'some', 'did not', 'need to be', 'in order to',
    'is available at', 'available at https', 'publicly available',
    'a wide range', 'wide range of', 'wide range', 'a combination of',
    'of the phylum', 'report the discovery', 'closely related', 'poorly understood',
    'species level', 'relative abundance', 'amino acid', 'rrna gene'
  ]);

  const filteredNodes = data.nodes.filter(n =>
    !excludePhrases.has(n.id) && n.count >= 6
  );

  const validNodeIds = new Set(filteredNodes.map(n => n.id));

  const filteredEdges = data.edges.filter(e =>
    validNodeIds.has(e.source) && validNodeIds.has(e.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    stats: data.stats
  };
}

/**
 * Create controls for the network
 */
function createControls(container) {
  const controls = document.createElement('div');
  controls.className = 'network-controls';
  controls.innerHTML = `
    <div class="control-group">
      <label for="edge-threshold">Connection Strength:</label>
      <input type="range" id="edge-threshold" min="5" max="30" value="${currentEdgeThreshold}" step="1">
      <span id="threshold-value">${currentEdgeThreshold}</span>
    </div>
    <button class="network-btn" id="reset-network">Reset View</button>
  `;
  container.appendChild(controls);

  const slider = controls.querySelector('#edge-threshold');
  const valueDisplay = controls.querySelector('#threshold-value');

  slider.addEventListener('input', (e) => {
    currentEdgeThreshold = parseInt(e.target.value);
    valueDisplay.textContent = currentEdgeThreshold;
  });

  slider.addEventListener('change', () => {
    const svgEl = container.querySelector('svg');
    const legend = container.querySelector('.network-legend');
    const stats = document.getElementById('network-stats');
    if (svgEl) svgEl.remove();
    if (legend) legend.remove();
    if (stats) stats.innerHTML = '';
    if (simulation) simulation.stop();
    initKeywordNetwork();
  });
}

/**
 * Create legend for the network
 */
function createLegend(container) {
  const legend = document.createElement('div');
  legend.className = 'network-legend';

  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-color" style="background: ${CATEGORY_COLORS[key]}"></span>
      <span class="legend-label">${label}</span>
    `;
    legend.appendChild(item);
  });

  container.appendChild(legend);
}

/**
 * Update stats display
 */
function updateStats(edgeCount) {
  const statsEl = document.getElementById('network-stats');
  if (statsEl && networkData) {
    statsEl.innerHTML = `
      <span><strong>${networkData.nodes.length}</strong> topics</span>
      <span><strong>${edgeCount}</strong> connections</span>
      <span>from <strong>${networkData.stats?.total_publications || 0}</strong> publications</span>
    `;
  }
}

/**
 * Highlight connections for a node
 */
function highlightConnections(node, nodes, edges) {
  const connectedIds = new Set([node.id]);
  const connectedEdges = new Set();

  networkData.edges.forEach(edge => {
    const sourceId = edge.source.id || edge.source;
    const targetId = edge.target.id || edge.target;
    if (sourceId === node.id) {
      connectedIds.add(targetId);
      connectedEdges.add(edge);
    }
    if (targetId === node.id) {
      connectedIds.add(sourceId);
      connectedEdges.add(edge);
    }
  });

  nodes.select('circle')
    .transition()
    .duration(200)
    .attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.15)
    .attr('stroke-width', d => d.id === node.id ? 4 : 2);

  nodes.select('text')
    .transition()
    .duration(200)
    .attr('opacity', d => connectedIds.has(d.id) ? 1 : 0.1)
    .attr('font-weight', d => d.id === node.id ? '700' : (d.count > 30 ? '600' : '400'));

  edges
    .transition()
    .duration(200)
    .attr('stroke-opacity', d => {
      const sourceId = d.source.id || d.source;
      const targetId = d.target.id || d.target;
      return (sourceId === node.id || targetId === node.id) ? 0.9 : 0.03;
    });
}

/**
 * Reset highlight state
 */
function resetHighlight(nodes, edges) {
  const edgeWeights = networkData.edges.filter(e => e.weight >= currentEdgeThreshold).map(e => e.weight);
  const minWeight = Math.min(...edgeWeights);
  const maxWeight = Math.max(...edgeWeights);
  const opacityScale = d3.scaleLinear().domain([minWeight, maxWeight]).range([0.15, 0.6]);

  nodes.select('circle')
    .transition()
    .duration(200)
    .attr('opacity', 0.9)
    .attr('stroke-width', 2);

  nodes.select('text')
    .transition()
    .duration(200)
    .attr('opacity', d => d.count > 15 ? 1 : 0.7)
    .attr('font-weight', d => d.count > 30 ? '600' : '400');

  edges
    .transition()
    .duration(200)
    .attr('stroke-opacity', d => opacityScale(d.weight));
}

/**
 * Reset network to initial state
 */
function resetNetwork() {
  if (!svg) return;

  svg.transition().duration(500).call(
    d3.zoom().transform,
    d3.zoomIdentity
  );

  if (simulation) {
    simulation.alpha(0.3).restart();
  }
}

/**
 * Drag handlers
 */
function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.1).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKeywordNetwork);
} else {
  initKeywordNetwork();
}
