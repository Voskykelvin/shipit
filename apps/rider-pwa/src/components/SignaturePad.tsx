import React, { useRef } from 'react';
import { Eraser, PenLine } from 'lucide-react';

export function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (signature: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const position = point(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const position = point(event);
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#0f172a';
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  function finishDrawing() {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  return (
    <div className="signature-field">
      <div className="signature-heading">
        <span>
          <PenLine size={14} /> Recipient signature (optional)
        </span>
        <button type="button" onClick={clearSignature} disabled={!value}>
          <Eraser size={14} /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        width={600}
        height={180}
        aria-label="Recipient signature pad"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
    </div>
  );
}
