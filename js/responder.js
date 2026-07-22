const URL_API = 'http://localhost:3000';

let selectFormulario = document.getElementById('select-formulario-responder');
let formResponder = document.getElementById('form-responder');
let responderTitulo = document.getElementById('responder-titulo');
let responderDescricao = document.getElementById('responder-descricao');
let inputNome = document.getElementById('respondente-nome');
let inputEmail = document.getElementById('respondente-email');
let perguntasResponderDiv = document.getElementById('perguntas-responder');
let btnEnviar = formResponder.querySelector('button[type="submit"]');
let responderErro = document.getElementById('responder-erro');
let responderSucesso = document.getElementById('responder-sucesso');

let formularioAtual = null;
let perguntasFormularioAtual = [];

async function listarFormulariosSelect() {
    let resposta = await fetch(`${URL_API}/formularios`);
    let formularios = await resposta.json();

    selectFormulario.innerHTML = '';

    for (let formulario of formularios) {
        selectFormulario.innerHTML += `<option value="${formulario.id}">${formulario.titulo}</option>`;
    }

    let parametros = new URLSearchParams(window.location.search);
    let idNaUrl = parametros.get('formularioId');

    if (idNaUrl && formularios.some(f => f.id === idNaUrl)) {
        selectFormulario.value = idNaUrl;
    }

    if (selectFormulario.value) {
        await carregarFormulario(selectFormulario.value);
    }
}

listarFormulariosSelect();

selectFormulario.addEventListener('change', function () {
    carregarFormulario(selectFormulario.value);
});

// Regra 4.3: só aceita respostas se estiver "publicado" e dentro do período de vigência
function formularioDisponivel(formulario) {
    if (formulario.status !== 'publicado') return false;

    let agora = new Date();

    if (formulario.dataInicio && agora < new Date(formulario.dataInicio)) return false;
    if (formulario.dataFim && agora > new Date(formulario.dataFim)) return false;

    return true;
}

function habilitarCamposRespondente(habilitar) {
    inputNome.disabled = !habilitar;
    inputEmail.disabled = !habilitar;
    btnEnviar.disabled = !habilitar;
}

async function carregarFormulario(id) {
    responderErro.textContent = '';
    responderSucesso.textContent = '';

    let resposta = await fetch(`${URL_API}/formularios/${id}`);
    formularioAtual = await resposta.json();
    perguntasFormularioAtual = [];

    responderTitulo.textContent = formularioAtual.titulo;
    responderDescricao.textContent = formularioAtual.descricao || '';
    perguntasResponderDiv.innerHTML = '';

    if (!formularioDisponivel(formularioAtual)) {
        habilitarCamposRespondente(false);
        responderErro.textContent = 'Este formulário está indisponível ou encerrado no momento.';
        return;
    }

    habilitarCamposRespondente(true);

    let respostaPerguntas = await fetch(`${URL_API}/perguntas`);
    let todasPerguntas = await respostaPerguntas.json();

    for (let idPergunta of formularioAtual.perguntas) {
        let pergunta = todasPerguntas.find(p => p.id === idPergunta);
        if (pergunta) perguntasFormularioAtual.push(pergunta);
    }

    for (let pergunta of perguntasFormularioAtual) {
        perguntasResponderDiv.innerHTML += construirFieldsetPergunta(pergunta);
    }
}

function construirFieldsetPergunta(pergunta) {
    let marcadorObrigatoria = pergunta.obrigatoria ? ' <span class="obrigatoria-marcador">*</span>' : '';
    let campoHtml = '';

    if (pergunta.tipo === 'multipla_escolha') {
        for (let alternativa of pergunta.alternativas) {
            campoHtml += `
                <label class="radio-label">
                    <input type="radio" name="resposta-pergunta-${pergunta.id}" value="${alternativa}"> ${alternativa}
                </label>
            `;
        }
    } else if (pergunta.tipo === 'checkbox') {
        for (let alternativa of pergunta.alternativas) {
            campoHtml += `
                <label class="checkbox-label">
                    <input type="checkbox" name="resposta-pergunta-${pergunta.id}" value="${alternativa}"> ${alternativa}
                </label>
            `;
        }
    } else if (pergunta.tipo === 'texto_curto') {
        campoHtml = `<input type="text" name="resposta-pergunta-${pergunta.id}" maxlength="200" placeholder="Escreva sua resposta (até 200 caracteres)">`;
    } else {
        campoHtml = `<textarea name="resposta-pergunta-${pergunta.id}" placeholder="Escreva sua resposta"></textarea>`;
    }

    return `
        <fieldset class="pergunta-resposta-item" data-pergunta-id="${pergunta.id}">
            <legend>${pergunta.enunciado}${marcadorObrigatoria}</legend>
            ${campoHtml}
        </fieldset>
    `;
}

function pegarValorResposta(pergunta) {
    if (pergunta.tipo === 'multipla_escolha') {
        let selecionado = document.querySelector(`input[name="resposta-pergunta-${pergunta.id}"]:checked`);
        return selecionado ? selecionado.value : '';
    }

    if (pergunta.tipo === 'checkbox') {
        let selecionados = document.querySelectorAll(`input[name="resposta-pergunta-${pergunta.id}"]:checked`);
        let valores = [];

        for (let checkbox of selecionados) {
            valores.push(checkbox.value);
        }

        return valores;
    }

    let campo = document.querySelector(`[name="resposta-pergunta-${pergunta.id}"]`);
    return campo ? campo.value.trim() : '';
}

// Regra 4.4: mesmo e-mail não pode responder o mesmo formulário mais de uma vez
async function emailJaRespondeu(formularioId, email) {
    let resposta = await fetch(`${URL_API}/respostas`);
    let respostas = await resposta.json();

    return respostas.some(r =>
        r.formularioId === formularioId
        && r.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
}

formResponder.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    responderErro.textContent = '';
    responderSucesso.textContent = '';

    if (!formularioAtual || !formularioDisponivel(formularioAtual)) {
        responderErro.textContent = 'Este formulário está indisponível ou encerrado no momento.';
        return;
    }

    let nome = inputNome.value.trim();
    let email = inputEmail.value.trim();

    if (nome.length < 2) {
        responderErro.textContent = 'O nome é obrigatório e deve ter ao menos 2 caracteres.';
        return;
    }

    let regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) {
        responderErro.textContent = 'Informe um e-mail em formato válido.';
        return;
    }

    if (await emailJaRespondeu(formularioAtual.id, email)) {
        responderErro.textContent = 'Esse e-mail já respondeu esse formulário.';
        return;
    }

    let respostas = [];
    let perguntasFaltando = [];

    for (let pergunta of perguntasFormularioAtual) {
        let valor = pegarValorResposta(pergunta);
        let respondida = pergunta.tipo === 'checkbox' ? valor.length > 0 : valor !== '';

        if (!respondida) {
            if (pergunta.obrigatoria) {
                perguntasFaltando.push(pergunta.enunciado);
            }
            continue;
        }

        if (pergunta.tipo === 'texto_curto' && valor.length > 200) {
            responderErro.textContent = `A resposta de "${pergunta.enunciado}" deve ter no máximo 200 caracteres.`;
            return;
        }

        respostas.push({ perguntaId: pergunta.id, valor: valor });
    }

    if (perguntasFaltando.length > 0) {
        responderErro.textContent = `Responda as perguntas obrigatórias: ${perguntasFaltando.join(', ')}.`;
        return;
    }

    await fetch(`${URL_API}/respostas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            formularioId: formularioAtual.id,
            nome: nome,
            email: email,
            respostas: respostas,
            enviadoEm: new Date().toISOString()
        })
    });

    responderSucesso.textContent = 'Resposta enviada com sucesso!';
    formResponder.reset();
    perguntasResponderDiv.innerHTML = '';
    habilitarCamposRespondente(false);
});
