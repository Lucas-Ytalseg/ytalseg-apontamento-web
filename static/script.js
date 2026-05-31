// ===== Protecao de login (porta de entrada) =====
const TOKEN = localStorage.getItem('ytalseg_token') || '';
const PERFIL = localStorage.getItem('ytalseg_perfil') || 'usuario';
const NOME_USUARIO = localStorage.getItem('ytalseg_nome') || '';
if(!TOKEN){ window.location.href = 'login.html'; }

function authHeaders(extra){
  return Object.assign({'Authorization':'Bearer '+TOKEN}, extra||{});
}
async function apiGet(url){
  const r = await fetch(url, {headers: authHeaders()});
  if(r.status === 401){ sairDoApp(); return null; }
  return r.json();
}
async function apiSend(url, method, body){
  const r = await fetch(url, {method, headers: authHeaders({'Content-Type':'application/json'}),
                             body: body?JSON.stringify(body):undefined});
  if(r.status === 401){ sairDoApp(); return {status:'erro'}; }
  return r.json();
}
function sairDoApp(){
  const t = localStorage.getItem('ytalseg_token');
  if(t){ fetch('/api/logout',{method:'POST',headers:{'Authorization':'Bearer '+t}}).catch(()=>{}); }
  localStorage.removeItem('ytalseg_token');
  localStorage.removeItem('ytalseg_perfil');
  localStorage.removeItem('ytalseg_nome');
  window.location.href = 'login.html';
}


const meses=['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const diasSemana=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const empresasPadrao=['GEO AMBIENTE','ENPRIN'];
const EMPRESAS_KEY='ytalseg_empresas_apontamento_lista_v32';
const EMPRESAS_ANTIGO_KEY='ytalseg_empresas_apontamento';

const canvas=document.getElementById('sheetCanvas'),ctx=canvas.getContext('2d');
const logoWatermark = new Image();
logoWatermark.src = 'assets/logo-watermark-clean.png';
const empresaSelect=document.getElementById('empresaSelect'),mesSelect=document.getElementById('mesSelect'),anoInput=document.getElementById('anoInput'),listaEmpresas=document.getElementById('listaEmpresas'),novaEmpresa=document.getElementById('novaEmpresa');
const horaDia=document.getElementById('horaDia'),servicoLocal=document.getElementById('servicoLocal'),horaDiurno=document.getElementById('horaDiurno'),horaNoturno=document.getElementById('horaNoturno');
let horarios = {};
function keyHorario(dia,tipo){ return `${anoInput.value}-${mesSelect.value}-${dia}-${tipo}` }


function normalizarEmpresas(v){return [...new Set((v||[]).map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
// Empresas agora ficam no SERVIDOR (sincroniza entre aparelhos).
// empresasCache guarda a lista em memoria; carregada ao abrir o app.
let empresasCache = [];
function empresas(){ return empresasCache; }
async function recarregarEmpresasDoServidor(sel){
  const data = await apiGet('/api/empresas');
  if(data && data.status === 'ok'){
    empresasCache = normalizarEmpresas(data.empresas || []);
  }
  carregarEmpresas(sel);
}
function carregarEmpresas(sel){
  const atual=sel||empresaSelect.value;
  const lista=empresas();
  empresaSelect.innerHTML='';
  lista.forEach(e=>{const op=document.createElement('option');op.value=e;op.textContent=e;empresaSelect.appendChild(op)});
  if(atual&&[...empresaSelect.options].some(o=>o.value===atual))empresaSelect.value=atual;
  else if(lista.length)empresaSelect.value=lista[0];
  renderEmpresas();
}
function escapeHtml(text){
  return String(text||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}
function renderEmpresas(){
  const lista=empresas();
  if(!lista.length){listaEmpresas.innerHTML='<div class="empresa-row"><strong>Nenhuma empresa cadastrada.</strong></div>';return;}
  listaEmpresas.innerHTML=lista.map((e,i)=>`<div class="empresa-row"><strong>${escapeHtml(e)}</strong><button class="small danger btn-excluir-empresa" data-index="${i}">Excluir</button></div>`).join('');
}
async function addEmpresa(){
  const nome=novaEmpresa.value.trim().toUpperCase();
  if(!nome)return;
  const data = await apiSend('/api/empresas','POST',{nome});
  if(data && data.status === 'ok'){
    novaEmpresa.value='';
    await recarregarEmpresasDoServidor(nome);
    render();
  } else {
    alert((data && data.detail) || 'Nao foi possivel salvar a empresa.');
  }
}
async function editarEmpresa(nome){
  const atual = String(nome||'').trim().toUpperCase();
  const novo=prompt('Editar nome da empresa:',atual);
  if(novo === null)return;
  const limpo=novo.trim().toUpperCase();
  if(!limpo){ alert('Nome da empresa não pode ficar vazio.'); return; }
  if(limpo === atual) return;
  if(empresas().includes(limpo)){ alert('Já existe uma empresa com esse nome.'); return; }
  // cria o novo nome e remove o antigo no servidor
  const c = await apiSend('/api/empresas','POST',{nome:limpo});
  if(!(c && c.status === 'ok')){ alert((c && c.detail) || 'Nao foi possivel renomear.'); return; }
  await apiSend('/api/empresas/'+encodeURIComponent(atual),'DELETE');
  await recarregarEmpresasDoServidor(limpo);
  render();
}
async function excluirEmpresa(nome){
  const atual = String(nome||'').trim().toUpperCase();
  if(!confirm(`Excluir empresa "${atual}"?`))return;
  const data = await apiSend('/api/empresas/'+encodeURIComponent(atual),'DELETE');
  if(data && data.status === 'ok'){
    await recarregarEmpresasDoServidor();
    render();
  } else {
    alert((data && data.detail) || 'Nao foi possivel excluir a empresa.');
  }
}

function pascoa(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(y,month-1,day)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function key(d){return`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}`}
function feriados(y){const m=new Map([['01-01','CONFRATERNIZAÇÃO'],['21-04','TIRADENTES'],['01-05','DIA DO TRABALHO'],['07-09','INDEPENDÊNCIA'],['12-10','NOSSA SENHORA'],['02-11','FINADOS'],['15-11','PROCLAMAÇÃO'],['20-11','CONSCIÊNCIA NEGRA'],['25-12','NATAL']]);const p=pascoa(y);m.set(key(addDays(p,-48)),'CARNAVAL');m.set(key(addDays(p,-47)),'CARNAVAL');m.set(key(addDays(p,-2)),'SEXTA-FEIRA SANTA');m.set(key(addDays(p,60)),'CORPUS CHRISTI');return m}
function fmt(d){return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}

function txt(text,x,y,w,size,color='#111',bold=false,align='center',family='Arial'){
 ctx.save();ctx.font=`${bold?'900 ':''}${size}px ${family}`;
 while(ctx.measureText(text).width>w&&size>7){size--;ctx.font=`${bold?'900 ':''}${size}px ${family}`}
 ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,align==='center'?x+w/2:x,y,w);ctx.restore();
}
function line(x1,y1,x2,y2,color='#005b2a',lw=1){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
const green='#009a44',grid='#8ca495',red='#ff0000';
const table={x:20,y:291,w:984,headerH:49,rowH:33,cols:[126,96,124,86,175,122,114,141]};

function drawWatermark(){
 ctx.save();
 ctx.globalAlpha = .12;
 const size = 980;
 const x = 22;
 const y = 325;
 if(logoWatermark.complete && logoWatermark.naturalWidth > 0){
   try { ctx.drawImage(logoWatermark, x, y, size, size); } catch(e) { console.warn('logo nao desenhada:', e); }
 }
 ctx.restore();
}
function drawPhone(x,y,phone,name){
 ctx.beginPath();ctx.arc(x+24,y+24,22,0,Math.PI*2);ctx.strokeStyle=green;ctx.lineWidth=3;ctx.stroke();
 txt('☎',x+5,y+24,38,24,green,true,'center','Arial');
 txt(phone,x+60,y+14,180,18,'#111',true,'left','Arial');
 txt(name,x+60,y+35,140,18,'#111',false,'left','Arial');
}
function drawLayout(){
 ctx.fillStyle='white';ctx.fillRect(0,0,1024,1536);
 txt('YTALSEG',35,62,390,82,green,true,'left','Times New Roman');
 txt('ASSESSORIA E SEGURANÇA DO TRABALHO.',43,126,390,19,green,true,'left','Arial');
 txt('EMPRESA',474,42,184,16,green,true,'left','Arial');txt('MÊS',686,42,142,16,green,true,'left','Arial');txt('ANO',854,42,124,16,green,true,'left','Arial');
 roundRect(474,61,184,58,6,'#fff','#777');roundRect(686,61,142,58,6,'#fff','#777');roundRect(854,61,124,58,6,'#fff','#777');
 ctx.fillStyle=green;ctx.fillRect(20,153,984,7);
 line(118,218,220,218,green,2);line(804,218,906,218,green,2);
 txt('FOLHA DE APONTAMENTO',0,215,1024,36,green,true,'center','Arial');
 txt('Técnicos Segurança Responsáveis : Yatta / Darlan / Valdemir',0,264,1024,20,green,true,'center','Arial');
 drawWatermark();
 let x=table.x,y=table.y,cx=x;const headers=['EMPRESA','DATA','DIA','MÊS','SERVIÇOS / LOCAL','HORÁRIOS\\nDIURNO','HORÁRIOS\\nNOTURNO','ASSINATURA'];
 for(let i=0;i<table.cols.length;i++){ctx.fillStyle=green;ctx.fillRect(cx,y,table.cols[i],table.headerH);ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.strokeRect(cx,y,table.cols[i],table.headerH);let parts=headers[i].split('\\n');if(parts.length===1)txt(parts[0],cx,y+25,table.cols[i],16,'#fff',true,'center','Arial');else{txt(parts[0],cx,y+18,table.cols[i],15,'#fff',true,'center','Arial');txt(parts[1],cx,y+33,table.cols[i],15,'#fff',true,'center','Arial')}cx+=table.cols[i]}
 for(let r=0;r<31;r++){cx=x;let ry=y+table.headerH+r*table.rowH;for(let c=0;c<table.cols.length;c++){ctx.fillStyle='rgba(255,255,255,.46)';ctx.fillRect(cx,ry,table.cols[c],table.rowH);ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.strokeRect(cx,ry,table.cols[c],table.rowH);cx+=table.cols[c]}}
 drawWatermark();
 for(let r=0;r<31;r++){cx=x;let ry=y+table.headerH+r*table.rowH;for(let c=0;c<table.cols.length;c++){ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.strokeRect(cx,ry,table.cols[c],table.rowH);cx+=table.cols[c]}}
 cx=x;for(let i=0;i<table.cols.length;i++){ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.strokeRect(cx,y,table.cols[i],table.headerH);cx+=table.cols[i]}
 ctx.fillStyle='red';ctx.fillRect(20,1365,19,19);txt('SÁBADOS, DOMINGOS E FERIADOS NACIONAIS EM VERMELHO',51,1375,520,14,'#111',true,'left','Arial');
 roundRect(13,1396,998,138,22,'#fff',green);drawPhone(78,1424,'(011) 9 5789-8196','Yatta');drawPhone(376,1424,'(011) 9 94711-9488','Valdemir');drawPhone(690,1424,'(011) 9 8407-7772','Darlan');txt('✉  financeiro.ytalseg@gmail.com',0,1504,1024,20,'#111',true,'center','Arial');
}
function render(){
 const empresa=empresaSelect.value||'GEO AMBIENTE',mes=Number(mesSelect.value),ano=Number(anoInput.value),fer=feriados(ano),total=new Date(ano,mes+1,0).getDate();
 drawLayout();txt(empresa,486,91,160,20,'#111',false,'left','Arial');txt(meses[mes],700,91,110,20,'#111',false,'left','Arial');txt(String(ano),870,91,90,20,'#111',false,'left','Arial');
 let y0=table.y+table.headerH+17,x0=table.x;
 for(let dia=1;dia<=total;dia++){const data=new Date(ano,mes,dia),ds=data.getDay(),f=fer.get(key(data)),isRed=ds===0||ds===6||!!f,diaTexto=f||diasSemana[ds],y=y0+(dia-1)*table.rowH;let cx=x0;txt(empresa,cx+3,y,table.cols[0]-6,13,'#111',false,'center','Arial');cx+=table.cols[0];txt(fmt(data),cx+3,y,table.cols[1]-6,13,f?red:'#111',!!f,'center','Arial');cx+=table.cols[1];txt(diaTexto,cx+3,y,table.cols[2]-6,f?10:13,isRed?red:'#111',isRed,'center','Arial');cx+=table.cols[2];txt(meses[mes],cx+3,y,table.cols[3]-6,13,'#111',false,'center','Arial');

 const servico = horarios[keyHorario(dia,'s')] || '';
 const diurno = horarios[keyHorario(dia,'d')] || '';
 const noturno = horarios[keyHorario(dia,'n')] || '';

 let sx = x0 + table.cols[0]+table.cols[1]+table.cols[2]+table.cols[3];
 txt(servico,sx+3,y,table.cols[4]-6,11,'#111',false,'center','Arial');
 let hx = sx + table.cols[4];
 txt(diurno,hx+3,y,table.cols[5]-6,11,'#111',false,'center','Arial');
 hx += table.cols[5];
 txt(noturno,hx+3,y,table.cols[6]-6,11,'#111',false,'center','Arial');
}
 preparePrintImage();
}
window.preparePrintImage=function(){document.getElementById('printImage').src=canvas.toDataURL('image/png')}
function fileName(prefix){const emp=(empresaSelect.value||'EMPRESA').replace(/[^\wÀ-ÿ]+/g,'_');const mes=meses[Number(mesSelect.value)]||'';const ano=anoInput.value||'';const pre=prefix?prefix+'_':'';return `${pre}${emp}_${mes}_${ano}`;}
function definirNomeArquivo(){ try{ document.title = fileName('Apontamento'); }catch(e){} }
function previewPDF(){render();definirNomeArquivo();window.print()}
function savePDF(){render();definirNomeArquivo();window.print()}
function limparTabela(){
 if(!confirm('Tem certeza que deseja limpar TODOS os servicos/locais e horarios desta tabela? Esta acao nao pode ser desfeita.')) return;
 horarios = {};
 if(typeof servicoLocal!=='undefined' && servicoLocal) servicoLocal.value='';
 if(typeof horaDiurno!=='undefined' && horaDiurno) horaDiurno.value='';
 if(typeof horaNoturno!=='undefined' && horaNoturno) horaNoturno.value='';
 if(typeof horaDia!=='undefined' && horaDia) horaDia.value='';
 render();
}
function printPage(){render();definirNomeArquivo();window.print()}
function tab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));

function aplicarHorarioMesTodo(){
 const mes = Number(mesSelect.value);
 const ano = Number(anoInput.value);
 const total = new Date(ano, mes + 1, 0).getDate();
 const servico = servicoLocal.value.trim();
 const diurno = horaDiurno.value.trim();
 const noturno = horaNoturno.value.trim();

 if(!servico && !diurno && !noturno){
   alert('Preencha Serviço/local, Horário diurno ou Horário noturno para aplicar no mês todo.');
   return;
 }

 for(let dia = 1; dia <= total; dia++){
   if(servico) horarios[keyHorario(dia,'s')] = servico;
   if(diurno) horarios[keyHorario(dia,'d')] = diurno;
   if(noturno) horarios[keyHorario(dia,'n')] = noturno;
 }
 render();
}

function adicionarHorarioPorBotao(){
 const dia = Number(horaDia.value);
 if(!dia || dia < 1 || dia > 31){ alert('Informe um dia válido de 1 a 31.'); return; }
 horarios[keyHorario(dia,'s')] = servicoLocal.value.trim();
 horarios[keyHorario(dia,'d')] = horaDiurno.value.trim();
 horarios[keyHorario(dia,'n')] = horaNoturno.value.trim();
 render();
}

document.querySelectorAll('.nav[data-tab]').forEach(b=>b.classList.remove('active'));const mapaAbas={empresas:'tabEmpresas',usuarios:'tabUsuarios',gerar:'tabGerar'};const alvo=document.getElementById(mapaAbas[name]||'tabGerar');if(alvo)alvo.classList.add('active');const btn=document.querySelector(`.nav[data-tab="${name}"]`);if(btn)btn.classList.add('active')}


function aplicarHorarioMesTodo(){
 const mes = Number(mesSelect.value);
 const ano = Number(anoInput.value);
 const total = new Date(ano, mes + 1, 0).getDate();
 const servico = servicoLocal.value.trim();
 const diurno = horaDiurno.value.trim();
 const noturno = horaNoturno.value.trim();

 if(!servico && !diurno && !noturno){
   alert('Preencha Serviço/local, Horário diurno ou Horário noturno para aplicar no mês todo.');
   return;
 }

 for(let dia = 1; dia <= total; dia++){
   if(servico) horarios[keyHorario(dia,'s')] = servico;
   if(diurno) horarios[keyHorario(dia,'d')] = diurno;
   if(noturno) horarios[keyHorario(dia,'n')] = noturno;
 }
 render();
}

function adicionarHorarioPorBotao(){
 const dia = Number(horaDia.value);
 if(!dia || dia < 1 || dia > 31){ alert('Informe um dia válido de 1 a 31.'); return; }
 horarios[keyHorario(dia,'s')] = servicoLocal.value.trim();
 horarios[keyHorario(dia,'d')] = horaDiurno.value.trim();
 horarios[keyHorario(dia,'n')] = horaNoturno.value.trim();
 render();
}

listaEmpresas.addEventListener('click',(e)=>{
 const btn=e.target.closest('button');
 if(!btn)return;
 const lista=empresas();
 const idx=Number(btn.dataset.index);
 const nome=lista[idx];
 if(!nome)return;
 if(btn.classList.contains('btn-excluir-empresa')) excluirEmpresa(nome);
});
document.querySelectorAll('.nav[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));document.getElementById('btnAddEmpresa').addEventListener('click',addEmpresa);document.getElementById('btnAddHorario').addEventListener('click',adicionarHorarioPorBotao);document.getElementById('btnAddHorarioMes').addEventListener('click',aplicarHorarioMesTodo);document.getElementById('btnUpdate').addEventListener('click',render);document.getElementById('btnPreview').addEventListener('click',previewPDF);document.getElementById('menuPreview').addEventListener('click',previewPDF);document.getElementById('btnSave').addEventListener('click',savePDF);document.getElementById('menuSave').addEventListener('click',savePDF);document.getElementById('btnPrint').addEventListener('click',printPage);document.getElementById('btnLimpar').addEventListener('click',limparTabela);document.getElementById('menuPrint').addEventListener('click',printPage);empresaSelect.addEventListener('change',render);mesSelect.addEventListener('change',render);anoInput.addEventListener('input',render);
meses.forEach((m,i)=>{const op=document.createElement('option');op.value=String(i);op.textContent=m;mesSelect.appendChild(op)});const now=new Date();mesSelect.value=String(now.getMonth());anoInput.value=now.getFullYear();recarregarEmpresasDoServidor('GEO AMBIENTE');render();
logoWatermark.onload = render;
logoWatermark.onerror = function(){ console.warn('logo nao carregou, seguindo sem ela'); render(); };


canvas.addEventListener('click',(e)=>{
 const rect = canvas.getBoundingClientRect();
 const scaleX = canvas.width / rect.width;
 const scaleY = canvas.height / rect.height;
 const mx = (e.clientX - rect.left) * scaleX;
 const my = (e.clientY - rect.top) * scaleY;

 const startY = table.y + table.headerH;
 const row = Math.floor((my - startY) / table.rowH);

 if(row >=0 && row < 31){
   let servicoX = table.x;
   for(let i=0;i<4;i++) servicoX += table.cols[i];
   let x = servicoX + table.cols[4];
   const diurnoX = x;
   const noturnoX = x + table.cols[5];

   if(mx >= servicoX && mx <= servicoX + table.cols[4] && my >= startY && my <= startY + 31*table.rowH){
      const atual = horarios[keyHorario(row+1,'s')] || '';
      const novo = prompt('SERVIÇO / LOCAL (ex: ALA 05 ou FÁBRICA GERAL)', atual);
      if(novo !== null){ horarios[keyHorario(row+1,'s')] = novo; render(); }
      return;
   }

   if(mx >= diurnoX && mx <= diurnoX + table.cols[5] && my >= startY && my <= startY + 31*table.rowH){
      const atual = horarios[keyHorario(row+1,'d')] || '';
      const novo = prompt('Horário DIURNO (ex: 07:00 - 18:00)', atual);
      if(novo !== null){ horarios[keyHorario(row+1,'d')] = novo; render(); }
   }

   if(mx >= noturnoX && mx <= noturnoX + table.cols[6] && my >= startY && my <= startY + 31*table.rowH){
      const atual = horarios[keyHorario(row+1,'n')] || '';
      const novo = prompt('Horário NOTURNO (ex: 19:00 - 05:00)', atual);
      if(novo !== null){ horarios[keyHorario(row+1,'n')] = novo; render(); }
   }
 }
});

// ===== Saudacao, botao Sair e aba Usuarios (admin) =====
(function configurarAcesso(){
  // Mostra a aba Usuarios so para admin
  if(PERFIL === 'admin'){
    const mu = document.getElementById('menuUsuarios');
    if(mu) mu.style.display = '';
  }
  // Botao Sair
  const bs = document.getElementById('btnSair');
  if(bs) bs.addEventListener('click', function(){
    if(confirm('Deseja sair do sistema?')) sairDoApp();
  });
  // Mostra o nome de quem entrou no subtitulo da sidebar
  const sub = document.querySelector('.side-sub');
  if(sub && NOME_USUARIO) sub.textContent = 'APONTAMENTO • ' + NOME_USUARIO;
})();

async function carregarUsuarios(){
  const box = document.getElementById('listaUsuarios');
  if(!box) return;
  const data = await apiGet('/api/usuarios');
  if(!data || data.status !== 'ok'){ box.innerHTML = '<div class="empresa-row">Não foi possível carregar.</div>'; return; }
  box.innerHTML = '';
  data.usuarios.forEach(function(u){
    const row = document.createElement('div');
    row.className = 'empresa-row';
    row.style.gridTemplateColumns = '1fr auto auto auto';
    const tag = u.perfil === 'admin' ? ' (admin)' : '';
    row.innerHTML = '<div style="font-weight:900">' + escapeHtml(u.usuario) + tag +
      (u.nome ? ' <span style="font-weight:600;color:#567">— ' + escapeHtml(u.nome) + '</span>' : '') + '</div>';
    const bSenha = document.createElement('button');
    bSenha.className = 'small primary'; bSenha.textContent = 'Trocar senha';
    bSenha.addEventListener('click', function(){ trocarSenhaUsuario(u.usuario); });
    const bDel = document.createElement('button');
    bDel.className = 'small danger'; bDel.textContent = 'Excluir';
    bDel.addEventListener('click', function(){ excluirUsuario(u.usuario); });
    row.appendChild(bSenha);
    row.appendChild(bDel);
    box.appendChild(row);
  });
}

async function criarUsuario(){
  const usuario = (document.getElementById('novoUsuario').value || '').trim();
  const nome = (document.getElementById('novoNome').value || '').trim();
  const senha = document.getElementById('novaSenhaUser').value || '';
  const perfil = document.getElementById('novoPerfil').value || 'usuario';
  if(!usuario || !senha){ alert('Preencha usuário e senha.'); return; }
  const data = await apiSend('/api/usuarios', 'POST', {usuario, nome, senha, perfil});
  if(data && data.status === 'ok'){
    document.getElementById('novoUsuario').value = '';
    document.getElementById('novoNome').value = '';
    document.getElementById('novaSenhaUser').value = '';
    carregarUsuarios();
  } else {
    alert((data && data.detail) || 'Não foi possível cadastrar.');
  }
}

async function trocarSenhaUsuario(usuario){
  const nova = prompt('Nova senha para ' + usuario + ':');
  if(nova === null) return;
  if(!nova.trim()){ alert('Senha não pode ser vazia.'); return; }
  const data = await apiSend('/api/usuarios/senha', 'POST', {usuario, nova_senha: nova});
  if(data && data.status === 'ok') alert('Senha alterada com sucesso.');
  else alert((data && data.detail) || 'Não foi possível trocar a senha.');
}

async function excluirUsuario(usuario){
  if(!confirm('Excluir o acesso de "' + usuario + '"? Esta ação não pode ser desfeita.')) return;
  const data = await apiSend('/api/usuarios/' + encodeURIComponent(usuario), 'DELETE');
  if(data && data.status === 'ok') carregarUsuarios();
  else alert((data && data.detail) || 'Não foi possível excluir.');
}

// Liga os botoes da aba usuarios (se existirem)
(function(){
  const bc = document.getElementById('btnCriarUsuario');
  if(bc) bc.addEventListener('click', criarUsuario);
  const mu = document.getElementById('menuUsuarios');
  if(mu) mu.addEventListener('click', carregarUsuarios);
})();
