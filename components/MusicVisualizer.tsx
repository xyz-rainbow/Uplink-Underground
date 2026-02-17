import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VisualizerProps {
  isPlaying: boolean;
  color?: string;
}

const MusicVisualizer: React.FC<VisualizerProps> = ({ isPlaying, color = '#00ffcc' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const barsRef = useRef<d3.Selection<SVGRectElement, number, SVGSVGElement, unknown> | null>(null);
  const requestRef = useRef<number | null>(null);

  // Constants
  const width = 800;
  const height = 120;
  const numBars = 80;
  const barWidth = width / numBars;
  const barPadding = 2;

  // Pre-allocate data array to avoid garbage collection in animation loop
  const dataRef = useRef(new Float32Array(numBars).fill(2));

  // Initialize SVG and bars (runs only once)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Clear existing content to prevent duplicates in dev/hot-reload
    svg.selectAll('*').remove();

    // Create bars and store the selection in a ref
    // Use the pre-allocated array for initial data
    barsRef.current = svg.selectAll('rect')
      .data(dataRef.current)
      .enter()
      .append('rect')
      .attr('x', (d, i) => i * barWidth)
      .attr('y', d => height - d)
      .attr('width', barWidth - barPadding)
      .attr('height', d => d)
      .attr('fill', color)
      .attr('opacity', 0.8)
      .attr('filter', 'blur(0.5px)');

    return () => {
      // Cleanup on unmount
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      svg.selectAll('*').remove();
    };
  }, []); // Empty dependency array = run once on mount

  // Handle color updates separately
  useEffect(() => {
    if (barsRef.current) {
      barsRef.current.attr('fill', color);
    }
  }, [color]);

  // Animation Loop
  useEffect(() => {
    if (!barsRef.current) return;

    const animate = () => {
      if (isPlaying) {
        // Update the pre-allocated array in place
        const data = dataRef.current;
        for (let i = 0; i < numBars; i++) {
          const base = Math.random() * height * 0.4;
          const peak = (i % 8 === 0) ? Math.random() * height * 0.6 : 0;
          data[i] = Math.max(2, base + peak); // Ensure minimum height of 2
        }

        // Update bars directly without D3 transitions for performance
        barsRef.current!
          .data(data)
          .attr('y', d => height - d)
          .attr('height', d => d)
          .attr('fill', (d) => d > height * 0.85 ? '#ffffff' : color);

        requestRef.current = requestAnimationFrame(animate);
      } else {
        // Reset to resting state efficiently
        // We can reuse the same array for reset too
        const data = dataRef.current;
        data.fill(2);

        barsRef.current!
          .data(data)
          .transition() // Use a single transition to smooth out the stop
          .duration(300)
          .ease(d3.easeQuadOut)
          .attr('y', height - 2)
          .attr('height', 2)
          .attr('fill', color);

        // Stop the loop
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
        }
      }
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      // Trigger the reset logic once when stopping
      animate();
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, color]); // Re-run when play state or color changes (for the loop logic)

  return (
    <div className="w-full flex justify-center items-center py-6 bg-black/80 border-y border-white/5 shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
      <div className="max-w-full overflow-hidden">
        <svg ref={svgRef} width="800" height="120" viewBox="0 0 800 120"></svg>
      </div>
    </div>
  );
};

export default MusicVisualizer;
