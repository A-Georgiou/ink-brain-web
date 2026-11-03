// The drifting colour field behind the page: the film's aurora as a small, low-resolution shader.
const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAGMENT = `precision mediump float;
uniform vec2 r;uniform float t;uniform float s;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
float blob(vec2 p,vec2 c,float k){vec2 d=p-c;return exp(-dot(d,d)/(k*k));}
void main(){
  vec2 uv=gl_FragCoord.xy/r;float a=r.x/r.y;vec2 p=vec2(uv.x*a,uv.y);
  vec2 w=vec2(fbm(p*1.4+vec2(t*.02,s*.6)),fbm(p*1.4+vec2(7.3-t*.017,3.1+s*.4)))-.5;
  vec2 q=p+w*.42;
  float ph=s*2.2;
  vec2 c1=vec2(a*(.2+.06*sin(t*.05+ph)),.8+.06*cos(t*.04+ph*.7)-s*.08);
  vec2 c2=vec2(a*(.82+.07*sin(t*.04+1.+ph*.8)),.72+.07*cos(t*.05+2.));
  vec2 c3=vec2(a*(.5+.12*sin(t*.03+3.-ph*.5)),.05+.06*cos(t*.03)+s*.1);
  vec2 cm=vec2(m.x*a,m.y);
  vec3 col=vec3(.0196,.0275,.047);
  col+=vec3(.639,.443,.969)*blob(q,c1,.62)*.40;
  col+=vec3(.345,.651,1.)*blob(q,c2,.56)*.32;
  col+=vec3(.247,.725,.314)*blob(q,c3,.5)*.17;
  col+=vec3(.6,.45,.95)*blob(p,cm,.35)*.06;
  col*=smoothstep(1.35,.2,length((uv-vec2(.5,.48))*vec2(1.,1.15)));
  col+=(h(gl_FragCoord.xy+fract(t))-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

export function startAurora(canvas) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
    if (!gl) return;
    const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = Object.fromEntries(["r", "t", "s", "m"].map((name) => [name, gl.getUniformLocation(program, name)]));

    // The field is soft, so a quarter-resolution buffer stretched by the browser looks the same and costs little.
    const resize = () => {
        canvas.width = Math.max(64, Math.round(innerWidth / 4));
        canvas.height = Math.max(64, Math.round(innerHeight / 4));
        gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener("resize", resize);

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const mouse = [0.5, 0.6];
    const eased = [0.5, 0.6];
    addEventListener("pointermove", (event) => {
        mouse[0] = event.clientX / innerWidth;
        mouse[1] = 1 - event.clientY / innerHeight;
    }, { passive: true });
    let scroll = 0;
    const start = performance.now();
    let last = 0;
    const frame = (now) => {
        requestAnimationFrame(frame);
        // Thirty frames a second is plenty for a field this slow.
        if (now - last < 32) return;
        last = now;
        const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        scroll += (scrollY / max - scroll) * 0.06;
        eased[0] += (mouse[0] - eased[0]) * 0.04;
        eased[1] += (mouse[1] - eased[1]) * 0.04;
        gl.uniform2f(uniform.r, canvas.width, canvas.height);
        gl.uniform1f(uniform.t, still.matches ? 0 : (now - start) / 1000);
        gl.uniform1f(uniform.s, scroll);
        gl.uniform2f(uniform.m, eased[0], eased[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(frame);
    canvas.classList.add("is-ready");
}
