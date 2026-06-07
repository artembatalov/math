"use strict";
/* Лёгкий 2D-плоттер на canvas (offline, без зависимостей).
   Использование:
     const p = new Plot(canvas, {xmin,xmax,ymin,ymax});
     p.setDraw(p => { p.grid(); p.axes(); p.curve(f,{color:'#1F6FEB'}); ... });
   p.render() — перерисовать; ресайз обрабатывается автоматически. */
class Plot {
  constructor(canvas, range){
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = Object.assign({xmin:-1,xmax:1,ymin:-1,ymax:1}, range||{});
    this.pad = {l:46, r:16, t:14, b:30};
    this.drawFn = null;
    window.addEventListener('resize', ()=>this.resize());
    this.resize();
  }
  setRange(r){ Object.assign(this.range, r); this.render(); }
  setDraw(fn){ this.drawFn = fn; this.render(); }
  resize(){
    const r = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width  = Math.max(1, Math.round(r.width*dpr));
    this.cv.height = Math.max(1, Math.round(r.height*dpr));
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.W = r.width; this.H = r.height;
    this.render();
  }
  render(){ if(!this.W) return; this.ctx.clearRect(0,0,this.W,this.H); if(this.drawFn) this.drawFn(this); }

  // --- координатные преобразования ---
  px(x){ const {xmin,xmax}=this.range, p=this.pad; return p.l + (x-xmin)/(xmax-xmin)*(this.W-p.l-p.r); }
  py(y){ const {ymin,ymax}=this.range, p=this.pad; return this.H-p.b - (y-ymin)/(ymax-ymin)*(this.H-p.t-p.b); }
  inY(y){ return y>=this.range.ymin && y<=this.range.ymax; }

  // --- «красивый» шаг сетки ---
  _step(span, target){
    const raw = span/target, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw/mag;
    const m = n<1.5?1 : n<3?2 : n<7?5 : 10;
    return m*mag;
  }
  grid(){
    const ctx=this.ctx, {xmin,xmax,ymin,ymax}=this.range;
    const sx=this._step(xmax-xmin,8), sy=this._step(ymax-ymin,6);
    ctx.save();
    ctx.strokeStyle='#eef1f5'; ctx.lineWidth=1; ctx.fillStyle='#9aa4b2';
    ctx.font='11px -apple-system,Segoe UI,Roboto,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    for(let x=Math.ceil(xmin/sx)*sx; x<=xmax+1e-9; x+=sx){
      ctx.beginPath(); ctx.moveTo(this.px(x),this.pad.t); ctx.lineTo(this.px(x),this.H-this.pad.b); ctx.stroke();
    }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let y=Math.ceil(ymin/sy)*sy; y<=ymax+1e-9; y+=sy){
      ctx.beginPath(); ctx.moveTo(this.pad.l,this.py(y)); ctx.lineTo(this.W-this.pad.r,this.py(y)); ctx.stroke();
    }
    ctx.restore();
  }
  axes(){
    const ctx=this.ctx, {xmin,xmax,ymin,ymax}=this.range;
    const sx=this._step(xmax-xmin,8), sy=this._step(ymax-ymin,6);
    const x0=this.px(0), y0=this.py(0);
    ctx.save();
    ctx.strokeStyle='#9aa4b2'; ctx.lineWidth=1.2; ctx.fillStyle='#5b6573';
    ctx.font='11px -apple-system,Segoe UI,Roboto,sans-serif';
    const ax = Math.min(Math.max(x0,this.pad.l), this.W-this.pad.r);
    const ay = Math.min(Math.max(y0,this.pad.t), this.H-this.pad.b);
    ctx.beginPath(); ctx.moveTo(this.pad.l,ay); ctx.lineTo(this.W-this.pad.r,ay); ctx.stroke(); // X
    ctx.beginPath(); ctx.moveTo(ax,this.pad.t); ctx.lineTo(ax,this.H-this.pad.b); ctx.stroke(); // Y
    ctx.textAlign='center'; ctx.textBaseline='top';
    const fmt=v=>Math.abs(v)<1e-9?'0':(Math.abs(v)<1e-3||Math.abs(v)>=1e4?v.toExponential(0):(+v.toFixed(3)).toString());
    for(let x=Math.ceil(xmin/sx)*sx; x<=xmax+1e-9; x+=sx){ if(Math.abs(x)<1e-9)continue;
      ctx.fillText(fmt(x), this.px(x), ay+4); }
    ctx.textAlign='right'; ctx.textBaseline='middle';
    for(let y=Math.ceil(ymin/sy)*sy; y<=ymax+1e-9; y+=sy){ if(Math.abs(y)<1e-9)continue;
      ctx.fillText(fmt(y), ax-5, this.py(y)); }
    ctx.restore();
  }
  // график функции с разрывом пера при выходе за рамку
  curve(f,{color='#1F6FEB',width=2,samples=600,dash=null}={}){
    const ctx=this.ctx, {xmin,xmax}=this.range;
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width; if(dash)ctx.setLineDash(dash);
    ctx.beginPath(); let pen=false;
    const m=(this.range.ymax-this.range.ymin); const lo=this.range.ymin-m, hi=this.range.ymax+m;
    for(let i=0;i<=samples;i++){
      const x=xmin+(xmax-xmin)*i/samples, y=f(x);
      if(!isFinite(y)||y<lo||y>hi){ pen=false; continue; }
      const X=this.px(x), Y=this.py(Math.max(this.range.ymin-m,Math.min(this.range.ymax+m,y)));
      if(pen) ctx.lineTo(X,Y); else { ctx.moveTo(X,Y); pen=true; }
    }
    ctx.stroke(); ctx.restore();
  }
  polyline(pts,{color='#C1121F',width=2,dots=false}={}){
    const ctx=this.ctx; ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width;
    ctx.beginPath();
    pts.forEach((p,i)=>{ const X=this.px(p[0]),Y=this.py(p[1]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); });
    ctx.stroke();
    if(dots){ ctx.fillStyle=color; pts.forEach(p=>{ ctx.beginPath(); ctx.arc(this.px(p[0]),this.py(p[1]),3,0,7); ctx.fill(); }); }
    ctx.restore();
  }
  // вертикальный «столбик» суммы Римана от 0 до h на [x0,x1]
  bar(x0,x1,h,{fill='rgba(31,111,235,.18)',stroke='#1F6FEB',lw=1}={}){
    const ctx=this.ctx; const X0=this.px(x0),X1=this.px(x1),Y0=this.py(0),Yh=this.py(h);
    ctx.save(); ctx.fillStyle=fill; ctx.strokeStyle=stroke; ctx.lineWidth=lw;
    ctx.beginPath(); ctx.rect(X0,Math.min(Y0,Yh),X1-X0,Math.abs(Yh-Y0)); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // полоса между f-eps и f+eps
  band(f,eps,{fill='rgba(31,111,235,.12)',samples=400}={}){
    const ctx=this.ctx,{xmin,xmax}=this.range; ctx.save(); ctx.fillStyle=fill; ctx.beginPath();
    for(let i=0;i<=samples;i++){ const x=xmin+(xmax-xmin)*i/samples; const X=this.px(x),Y=this.py(f(x)+eps); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}
    for(let i=samples;i>=0;i--){ const x=xmin+(xmax-xmin)*i/samples; ctx.lineTo(this.px(x),this.py(f(x)-eps)); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
