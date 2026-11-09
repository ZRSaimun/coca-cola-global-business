(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('heroWebgl');
  const status = document.querySelector('.hero-webgl-status');
  if (!hero || !canvas) return;

  document.documentElement.classList.add('motion-ready');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Small, dependency-free WebGL scene: a glass bottle in front of a connected globe.
  function startBottleScene() {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!gl || motionPreference.matches) { if (status) status.hidden = true; return; }

    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      uniform mat4 uMvp;
      uniform mat4 uModel;
      uniform float uPointSize;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main(){
        vec4 world = uModel * vec4(aPosition, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(uModel) * aNormal);
        gl_Position = uMvp * vec4(aPosition, 1.0);
        gl_PointSize = uPointSize;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform vec4 uColor;
      uniform float uMode;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main(){
        vec3 n = normalize(vNormal);
        if(uMode > 2.5){ gl_FragColor = uColor; return; }
        vec3 viewDir = normalize(vec3(0.0, 0.0, 5.7) - vWorld);
        vec3 lightDir = normalize(vec3(-0.45, 0.85, 1.0));
        float diffuse = 0.28 + max(dot(n, lightDir), 0.0) * 0.68;
        float rim = pow(1.0 - max(abs(dot(n, viewDir)), 0.0), 2.2);
        vec3 halfDir = normalize(lightDir + viewDir);
        float shine = pow(max(dot(n, halfDir), 0.0), 44.0);
        vec3 color = uColor.rgb * diffuse;
        if(uMode < 0.5){
          color = mix(color, vec3(0.82,0.92,1.0), rim * 0.78) + vec3(1.0,0.76,0.72) * shine * 0.6;
        } else if(uMode < 1.5){
          color = mix(color, vec3(1.0,0.16,0.24), shine * 0.28) + vec3(1.0) * shine * 0.26;
        } else {
          color = color + vec3(1.0,0.18,0.1) * rim * 0.3 + vec3(1.0,0.5,0.38) * shine * 0.42;
        }
        gl_FragColor = vec4(color, uColor.a);
      }
    `;
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    let program;
    try {
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    } catch (error) { if (status) status.hidden = true; return; }

    gl.useProgram(program);
    const loc = {
      position: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal'),
      mvp: gl.getUniformLocation(program, 'uMvp'), model: gl.getUniformLocation(program, 'uModel'),
      color: gl.getUniformLocation(program, 'uColor'), mode: gl.getUniformLocation(program, 'uMode'),
      point: gl.getUniformLocation(program, 'uPointSize')
    };
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const ident = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    function multiply(a,b){ const o=new Float32Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return o; }
    function translate(x,y,z){const m=ident();m[12]=x;m[13]=y;m[14]=z;return m;}
    function scale(x,y,z){const m=ident();m[0]=x;m[5]=y;m[10]=z;return m;}
    function rotateY(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);}
    function rotateX(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);}
    function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;}
    const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const norm=v=>{const d=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/d,v[1]/d,v[2]/d];};
    function lookAt(eye,center,up){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}

    function mesh(positions,normals,mode){
      const p=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(positions),gl.STATIC_DRAW);
      const n=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,n);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW);
      return {p,n,count:positions.length/3,mode};
    }
    function lathe(profile,segments=64){
      const pos=[],nor=[],idx=[];
      for(let j=0;j<profile.length;j++){
        const [r,y]=profile[j],before=profile[Math.max(0,j-1)],after=profile[Math.min(profile.length-1,j+1)];
        const slope=(after[0]-before[0])/((after[1]-before[1])||0.0001), inv=1/Math.sqrt(1+slope*slope),nr=inv,ny=-slope*inv;
        for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,s=Math.sin(a),c=Math.cos(a);pos.push(r*s,y-1.35,r*c);nor.push(nr*s,ny,nr*c);}
      }
      for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,b,b+1,a+1);}
      return indexedMesh(pos,nor,idx);
    }
    function indexedMesh(pos,nor,idx){
      const p=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
      const n=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,n);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);
      const e=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,e);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);
      return {p,n,e,count:idx.length,mode:gl.TRIANGLES,indexed:true};
    }
    function sphere(rings=20,segs=36){const p=[],n=[],idx=[];for(let y=0;y<=rings;y++){const v=y/rings,phi=v*Math.PI;for(let x=0;x<=segs;x++){const u=x/segs,theta=u*Math.PI*2,px=Math.sin(phi)*Math.cos(theta),py=Math.cos(phi),pz=Math.sin(phi)*Math.sin(theta);p.push(px,py,pz);n.push(px,py,pz);}}for(let y=0;y<rings;y++)for(let x=0;x<segs;x++){const a=y*(segs+1)+x,b=a+segs+1;idx.push(a,b,a+1,b,b+1,a+1);}return indexedMesh(p,n,idx);}
    function lineMesh(points,mode=gl.LINES){const p=[],n=[];points.forEach(v=>{p.push(v[0],v[1],v[2]);n.push(0,1,0);});const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.STATIC_DRAW);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(n),gl.STATIC_DRAW);return {p:b,n:nb,count:p.length/3,mode};}
    function latLon(lat,lon,r){const a=lat*Math.PI/180,b=lon*Math.PI/180;return [r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b)];}
    function globeGrid(){const pts=[],R=1.6;for(let lat=-75;lat<=75;lat+=15){for(let lon=-180;lon<180;lon+=4){pts.push(latLon(lat,lon,R),latLon(lat,lon+4,R));}}for(let lon=-180;lon<180;lon+=15){for(let lat=-88;lat<88;lat+=4){pts.push(latLon(lat,lon,R),latLon(lat+4,lon,R));}}return lineMesh(pts,gl.LINES);}
    function route(from,to){const a=norm(latLon(from[0],from[1],1)),b=norm(latLon(to[0],to[1],1));let omega=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));const sin=Math.sin(omega)||1,points=[];for(let i=0;i<=40;i++){const t=i/40;let v;if(omega<.01)v=a;else v=[0,1,2].map(k=>Math.sin((1-t)*omega)/sin*a[k]+Math.sin(t*omega)/sin*b[k]);const lift=1.62+.1*Math.sin(Math.PI*t);points.push(norm(v).map(x=>x*lift));}return points;}
    const globe=globeGrid(),routeData=[[[37,-122],[51,-.1]],[[40,-74],[35,139]],[[19,72],[1,104]],[[30,31],[-33,151]],[[37,-122],[-23,-46]]].map(([a,b])=>route(a,b));
    const routes=routeData.map(r=>lineMesh(r,gl.LINE_STRIP));
    const glass=lathe([[0,.02],[.34,.04],[.49,.09],[.55,.18],[.57,.4],[.56,.72],[.54,1.0],[.535,1.28],[.51,1.48],[.47,1.63],[.38,1.78],[.28,1.91],[.235,2.02],[.235,2.38],[.27,2.43],[.265,2.49],[.215,2.5],[.215,2.43],[0,2.43]],64);
    const liquid=lathe([[0,.08],[.42,.08],[.49,.15],[.51,.38],[.50,.75],[.49,1.02],[.46,1.12],[0,1.12]],48);
    const label=lathe([[.54,.93],[.54,1.38]],64);
    const cap=lathe([[.235,2.48],[.25,2.50],[.25,2.70],[.23,2.72],[0,2.72]],48);
    const capRing=lathe([[.251,2.52],[.257,2.55]],48), baseRing=lathe([[.52,.11],[.565,.13],[.568,.16],[.53,.18]],64);
    const nodeSphere=sphere(9,14);
    const hubGeo=[[-.1,-.55],[37,-122],[51,-.1],[35,139],[1,104],[-23,-46]].map((ll,i)=>({p:latLon(ll[0],ll[1],1.64),phase:i*.17}));
    const matrices={view:lookAt([0,0,6.15],[0,0,0],[0,1,0])};
    let pointerX=0,pointerY=0,targetX=0,targetY=0,scrollShift=0,visible=true,last=0,raf=0;
    let width=0,height=0;
    let projection=perspective(36*Math.PI/180,1,.1,50);
    function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.35);width=Math.max(1,Math.round(rect.width*dpr));height=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}gl.viewport(0,0,width,height);projection=perspective(36*Math.PI/180,width/height,.1,50);}
    function bind(m){gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,0,0);if(m.indexed)gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.e);}
    function draw(m,model,color,mode,alpha=1){bind(m);const mvp=multiply(multiply(projection,matrices.view),model);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform4f(loc.color,color[0],color[1],color[2],alpha);gl.uniform1f(loc.mode,mode);gl.uniform1f(loc.point,1);if(m.indexed)gl.drawElements(m.mode,m.count,gl.UNSIGNED_SHORT,0);else gl.drawArrays(m.mode,0,m.count);}
    function slerpPoint(points,t){const f=t*(points.length-1),i=Math.floor(f),u=f-i,a=points[i],b=points[Math.min(points.length-1,i+1)];return a.map((v,k)=>v+(b[k]-v)*u);}
    function frame(now){if(!visible){raf=0;return;}raf=requestAnimationFrame(frame);if(now-last<30)return;last=now;const t=now*.001;pointerX+=(targetX-pointerX)*.035;pointerY+=(targetY-pointerY)*.035;scrollShift+=(Math.min(window.scrollY/600,.45)-scrollShift)*.04;
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      let globeModel=multiply(translate(0,0,-1.2),multiply(rotateY(t*.075+pointerX*.12),rotateX(pointerY*.05)));
      draw(globe,globeModel,[.82,.25,.3,.48],3,.47);
      routeData.forEach((r,i)=>draw(routes[i],globeModel,[1,.18,.25,.7],3,.68));
      hubGeo.forEach((hub,i)=>{const p=hub.p;const m=multiply(globeModel,multiply(translate(p[0],p[1],p[2]),scale(i===0?.055:.036,i===0?.055:.036,i===0?.055:.036)));draw(nodeSphere,m,[1,.25,.32,1],2,1);});
      routeData.forEach((r,i)=>{const p=slerpPoint(r,(t*.16+i*.21)%1),m=multiply(globeModel,multiply(translate(p[0],p[1],p[2]),scale(.022,.022,.022)));draw(nodeSphere,m,[1,.77,.59,1],2,1);});
      const spin=t*.16+pointerX*.22,tilt=Math.sin(t*.31)*.045+pointerY*.08-scrollShift*.12;
      const bottleModel=multiply(translate(.02,-scrollShift*.17,.55),multiply(rotateY(spin),rotateX(tilt)));
      draw(liquid,bottleModel,[.16,.025,.025,1],2,1);
      draw(glass,bottleModel,[.72,.82,.84,.28],0,.28);
      draw(baseRing,bottleModel,[.75,.88,.92,.8],0,.8);
      draw(label,bottleModel,[.84,.025,.075,1],1,1);
      draw(capRing,bottleModel,[1,.3,.34,1],1,1);
      draw(cap,bottleModel,[.75,.015,.055,1],1,1);
    }
    function pointer(event){const rect=canvas.getBoundingClientRect();targetX=((event.clientX-rect.left)/rect.width-.5)*2;targetY=((event.clientY-rect.top)/rect.height-.5)*2;}
    hero.addEventListener('pointermove',pointer,{passive:true});hero.addEventListener('pointerleave',()=>{targetX=0;targetY=0;},{passive:true});
    const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!raf)raf=requestAnimationFrame(frame);},{threshold:.01});visibility.observe(hero);
    if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize,{passive:true});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();hero.classList.remove('webgl-ready');if(status)status.hidden=true;},{passive:false});
    resize();hero.classList.add('webgl-ready');raf=requestAnimationFrame(frame);
  }

  function revealSections(){
    const items=document.querySelectorAll('.poster-section,.framework,.lens-card,.network,.conclusion,.sources');
    items.forEach(el=>el.classList.add('reveal-on-scroll'));
    if(!('IntersectionObserver' in window)){items.forEach(el=>el.classList.add('is-visible'));return;}
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -4% 0px'});
    items.forEach(el=>observer.observe(el));
  }
  revealSections();
  startBottleScene();
})();
