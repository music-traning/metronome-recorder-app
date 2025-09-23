
import React, { useRef, useEffect } from 'react';

interface WaveformProps {
  analyserNode: AnalyserNode | null;
}

const Waveform: React.FC<WaveformProps> = ({ analyserNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Resize canvas to fit container
    const resizeCanvas = () => {
      if(canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);


    if (!analyserNode) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if(animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      return;
    }

    analyserNode.fftSize = 2048;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameId.current = requestAnimationFrame(draw);
      
      analyserNode.getByteTimeDomainData(dataArray);

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 2;
      context.strokeStyle = 'rgb(34 211 238)'; // cyan-400
      context.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
        x += sliceWidth;
      }

      context.lineTo(canvas.width, canvas.height / 2);
      context.stroke();
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [analyserNode]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Waveform;
