const URL_API = 'http://localhost:3000';

let formFormulario = document.getElementById('form-formulario');
let inputId = document.getElementById('formulario-id');
let inputTitulo = document.getElementById('formulario-titulo');
let inputDescricao = document.getElementById('formulario-descricao');
let selectStatus = document.getElementById('formulario-status');
let inputDataInicio = document.getElementById('formulario-data-inicio');
let inputDataFim = document.getElementById('formulario-data-fim');
let listaPerguntasCheckbox = document.getElementById('lista-perguntas-checkbox');
let btnCancelar = document.getElementById('btn-cancelar-formulario');
let secaoFormularios = document.getElementById('lista-formularios');
let mensagemErro = document.getElementById('formulario-erro');
let infoRestricao = document.getElementById('formulario-restricao-info');

let formularioEmEdicao = null; // guarda o formulário original enquanto ele está sendo editado

async function listarFormularios() {
    secaoFormularios.innerHTML = '';

    let resposta = await fetch(`${URL_API}/formularios`);
    let formularios = await resposta.json();

    for (let formulario of formularios) {
        secaoFormularios.innerHTML += `

            <article class="card formulario-card" data-id="${formulario.id}">
                <div class="card-header">
                    <span class="badge badge-status badge-${formulario.status}">${formulario.status}</span>
                    <span class="formulario-periodo">${formatarPeriodo(formulario.dataInicio, formulario.dataFim)}</span>
                </div>
                <h4 class="formulario-titulo">${formulario.titulo}</h4>
                <p class="formulario-descricao">${formulario.descricao || ''}</p>
                <p class="formulario-qtd-perguntas">${formatarQtdPerguntas(formulario.perguntas.length)}</p>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-editar-formulario">Editar</button>
                    <button class="btn btn-secondary btn-ver-respostas">Ver respostas</button>
                    ${formulario.status !== 'encerrado' ? '<button class="btn btn-warning btn-encerrar-formulario">Encerrar</button>' : ''}
                </div>
            </article>

        `;
    }
}

listarFormularios();

function formatarQtdPerguntas(quantidade) {
    return quantidade === 1 ? '1 pergunta' : `${quantidade} perguntas`;
}

function formatarData(dataIso) {
    if (!dataIso) return '';
    return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function formatarPeriodo(dataInicio, dataFim) {
    if (!dataInicio && !dataFim) return 'Sem período definido';
    return `${formatarData(dataInicio)} a ${formatarData(dataFim)}`;
}

function formatarTipoPergunta(tipo) {
    let tipos = {
        multipla_escolha: 'Múltipla escolha',
        texto_curto: 'Texto curto',
        texto_longo: 'Texto longo',
        checkbox: 'Checkbox'
    };

    return tipos[tipo];
}

// Monta a lista de checkboxes a partir do banco de perguntas cadastradas
async function listarPerguntasCheckbox(selecionadas, desabilitado) {
    selecionadas = selecionadas || [];

    let resposta = await fetch(`${URL_API}/perguntas`);
    let perguntas = await resposta.json();

    listaPerguntasCheckbox.innerHTML = '';

    for (let pergunta of perguntas) {
        let marcado = selecionadas.includes(pergunta.id) ? 'checked' : '';
        let travado = desabilitado ? 'disabled' : '';

        listaPerguntasCheckbox.innerHTML += `
            <label class="checkbox-label">
                <input type="checkbox" class="formulario-pergunta-checkbox" value="${pergunta.id}" ${marcado} ${travado}>
                ${pergunta.enunciado} (${formatarTipoPergunta(pergunta.tipo)})
            </label>
        `;
    }
}

listarPerguntasCheckbox();

function pegarPerguntasSelecionadas() {
    let checkboxes = listaPerguntasCheckbox.querySelectorAll('.formulario-pergunta-checkbox:checked');
    let ids = [];

    for (let checkbox of checkboxes) {
        ids.push(checkbox.value);
    }

    return ids;
}

// Regras 4.7 e 4.9: formulário com respostas vinculadas não pode ser excluído
// e só pode ter título/descrição alterados (o resto fica travado na edição)
async function formularioTemRespostas(id) {
    let resposta = await fetch(`${URL_API}/respostas`);
    let respostas = await resposta.json();

    return respostas.some(r => r.formularioId === id);
}

function travarCamposRestritos(travar) {
    selectStatus.disabled = travar;
    inputDataInicio.disabled = travar;
    inputDataFim.disabled = travar;

    let checkboxes = listaPerguntasCheckbox.querySelectorAll('.formulario-pergunta-checkbox');
    for (let checkbox of checkboxes) {
        checkbox.disabled = travar;
    }

    infoRestricao.textContent = travar
        ? 'Esse formulário já tem respostas: só é possível alterar título e descrição.'
        : '';
}

formFormulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    mensagemErro.textContent = '';

    let titulo = inputTitulo.value.trim();
    let descricao = inputDescricao.value.trim();
    let status = selectStatus.value;
    let dataInicio = inputDataInicio.value ? new Date(inputDataInicio.value).toISOString() : '';
    let dataFim = inputDataFim.value ? new Date(inputDataFim.value).toISOString() : '';
    let perguntas = pegarPerguntasSelecionadas();

    if (titulo === '') {
        mensagemErro.textContent = 'O título é obrigatório.';
        return;
    }

    if (perguntas.length === 0) {
        mensagemErro.textContent = 'Selecione ao menos uma pergunta para o formulário.';
        return;
    }

    if (dataInicio && dataFim && dataFim < dataInicio) {
        mensagemErro.textContent = 'A data fim não pode ser anterior à data início.';
        return;
    }

    // Regra 4.9: formulário já respondido só pode ter título/descrição alterados
    if (inputId.value !== '' && formularioEmEdicao && await formularioTemRespostas(inputId.value)) {
        status = formularioEmEdicao.status;
        dataInicio = formularioEmEdicao.dataInicio;
        dataFim = formularioEmEdicao.dataFim;
        perguntas = formularioEmEdicao.perguntas;
    }

    let formulario = {
        titulo: titulo,
        descricao: descricao,
        perguntas: perguntas,
        status: status,
        dataInicio: dataInicio,
        dataFim: dataFim,
        criadoEm: formularioEmEdicao ? formularioEmEdicao.criadoEm : new Date().toISOString()
    };

    if (inputId.value === '') {
        await fetch(`${URL_API}/formularios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formulario)
        });
    } else {
        await fetch(`${URL_API}/formularios/${inputId.value}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formulario)
        });
    }

    limparFormulario();
    listarFormularios();
});

btnCancelar.addEventListener('click', limparFormulario);

function limparFormulario() {
    inputId.value = '';
    formularioEmEdicao = null;
    formFormulario.reset();
    mensagemErro.textContent = '';

    travarCamposRestritos(false);
    listarPerguntasCheckbox();
}

// Delegação, já que os cards de formulário são recriados a cada listarFormularios()
secaoFormularios.addEventListener('click', async function (evento) {
    let card = evento.target.closest('.formulario-card');
    if (!card) return;

    let id = card.dataset.id;

    if (evento.target.classList.contains('btn-ver-respostas')) {
        window.location.href = `/pages/respostas.html?formularioId=${id}`;
    }

    if (evento.target.classList.contains('btn-encerrar-formulario')) {
        let confirmar = confirm('Encerrar este formulário? Ele deixará de aceitar novas respostas.');
        if (!confirmar) return;

        let resposta = await fetch(`${URL_API}/formularios/${id}`);
        let formulario = await resposta.json();

        formulario.status = 'encerrado';

        await fetch(`${URL_API}/formularios/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formulario)
        });

        listarFormularios();
    }

    if (evento.target.classList.contains('btn-editar-formulario')) {
        let resposta = await fetch(`${URL_API}/formularios/${id}`);
        let formulario = await resposta.json();

        formularioEmEdicao = formulario;
        inputId.value = formulario.id;
        inputTitulo.value = formulario.titulo;
        inputDescricao.value = formulario.descricao || '';
        selectStatus.value = formulario.status;
        inputDataInicio.value = formulario.dataInicio ? formulario.dataInicio.slice(0, 10) : '';
        inputDataFim.value = formulario.dataFim ? formulario.dataFim.slice(0, 10) : '';

        let temRespostas = await formularioTemRespostas(id);
        await listarPerguntasCheckbox(formulario.perguntas, temRespostas);
        travarCamposRestritos(temRespostas);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
