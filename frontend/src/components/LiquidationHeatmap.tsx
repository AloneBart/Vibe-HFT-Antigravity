import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute float a_intensity;
  varying float v_intensity;
  
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_intensity = a_intensity;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying float v_intensity;
  
  void main() {
    // Heatmap gradient: Blue -> Green -> Red
    vec3 color = vec3(0.0);
    if (v_intensity < 0.5) {
      color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), v_intensity * 2.0);
    } else {
      color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (v_intensity - 0.5) * 2.0);
    }
    gl_FragColor = vec4(color, 0.6); // 0.6 alpha for overlay effect
  }
`;

interface LiquidationHeatmapProps {
    data: { price: number; volume: number }[];
}

export const LiquidationHeatmap: React.FC<LiquidationHeatmapProps> = ({ data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl');
        if (!gl) {
            console.error('WebGL not supported');
            return;
        }

        // Compile Shaders
        const createShader = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

        if (!vertexShader || !fragmentShader) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return;
        }

        gl.useProgram(program);

        // Create Buffer
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Mock data generation for visualization if data is empty
        const points: number[] = [];
        if (data.length === 0) {
            // Generate a grid of points
            for (let i = 0; i < 100; i++) {
                const x = (Math.random() * 2 - 1);
                const y = (Math.random() * 2 - 1);
                const intensity = Math.random();
                points.push(x, y, intensity);
            }
        } else {
            // Normalize data to clip space (-1 to 1)
            // This is a simplified mapping for demonstration
            data.forEach(d => {
                points.push((Math.random() * 2 - 1), (Math.random() * 2 - 1), d.volume / 1000);
            });
        }

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

        const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
        const intensityAttributeLocation = gl.getAttribLocation(program, 'a_intensity');

        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 3 * 4, 0);

        gl.enableVertexAttribArray(intensityAttributeLocation);
        gl.vertexAttribPointer(intensityAttributeLocation, 1, gl.FLOAT, false, 3 * 4, 2 * 4);

        // Draw
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.POINTS, 0, points.length / 3);

    }, [data]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={400}
            className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-50"
        />
    );
};
