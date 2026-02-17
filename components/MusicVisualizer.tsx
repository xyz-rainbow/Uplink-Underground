
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VisualizerProps {
  isPlaying: boolean;
  color?: string;
}

const MusicVisualizer: React.FC<VisualizerProps> = ({ isPlaying, color = '#00ffcc' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 120;
    const barPadding = 2;
    const numBars = 80;
    const barWidth = width / numBars;

    svg.selectAll('*').remove();

    const data = Array.from({ length: numBars }, () => 2);

    const bars = svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d, i) => i * barWidth)
      .attr('y', d => height - d)
      .attr('width', barWidth - barPadding)
      .attr('height', d => d)
      .attr('fill', color)
      .attr('opacity', 0.8)
      .attr('filter', 'blur(0.5px)');

    let animationFrameId: number;

    const update = () => {
      if (isPlaying) {
        // Generar datos con más "ruido" y picos aleatorios para mayor impacto visual
        const newData = Array.from({ length: numBars }, (_, i) => {
          const base = Math.random() * height * 0.4;
          const peak = (i % 8 === 0) ? Math.random() * height * 0.6 : 0;
          return base + peak;
        });

        bars.data(newData)
          .transition()
          .duration(60)
          .ease(d3.easeLinear)
          .attr('y', d => height - d)
          .attr('height', d => d)
          .attr('fill', (d) => d > height * 0.85 ? '#ffffff' : color);
      } else {
        bars.data(Array.from({ length: numBars }, () => 2))
          .transition()
          .duration(500)
          .attr('y', height - 2)
          .attr('height', 2)
          .attr('fill', color);
      }
      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, color]);

  return (
    <div className="w-full flex justify-center items-center py-6 bg-black/80 border-y border-white/5 shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
      <div className="max-w-full overflow-hidden">
        <svg ref={svgRef} width="800" height="120" viewBox="0 0 800 120"></svg>
      </div>
    </div>
  );
};

export default MusicVisualizer;
