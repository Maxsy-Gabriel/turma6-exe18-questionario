const URL_API = 'http://localhost:3000';

let formPergunta = document.getElementById('form-pergunta');
let inputId = document.getElementById('pergunta-id');
let inputEnunciado = document.getElementById('pergunta-enunciado');
let selectTipo = document.getElementById('pergunta-tipo');
let inputObrigatoria = document.getElementById('pergunta-obrigatoria');
let wrapperAlternativas = document.getElementById('pergunta-alternativas-wrapper');
let infoTipo = document.getElementById('pergunta-tipo-info');
let listaAlternativas = document.getElementById('lista-alternativas');
let btnAddAlternativa = document.getElementById('btn-add-alternativa');
let btnCancelar = document.getElementById('btn-cancelar-pergunta');
let secaoPerguntas = document.getElementById('lista-perguntas');
let mensagemErro = document.getElementById('pergunta-erro');

let perguntaEmEdicao = null; // guarda a pergunta original enquanto ela está sendo editada

async function listarPerguntas() {
    secaoPerguntas.innerHTML = '';

    let resposta = await fetch(`${URL_API}/perguntas`, {
        method: "GET"
    });

    let perguntas = await resposta.json();

    for (let pergunta of perguntas) {
        secaoPerguntas.innerHTML += `

            <article class="card pergunta-card" data-id="${pergunta.id}">
                <div class="card-header">
                    <span class="badge badge-tipo">${formatarTipo(pergunta.tipo)}</span>
                    <span class="badge ${pergunta.obrigatoria ? 'badge-obrigatoria' : 'badge-opcional'}">${pergunta.obrigatoria ? 'Obrigatória' : 'Opcional'}</span>
                </div>
                <p class="pergunta-enunciado">${pergunta.enunciado}</p>
                <ul class="chips-list">
                    ${listarOpcoesPerguntas(pergunta.alternativas)}
                </ul>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-editar-pergunta">Editar</button>
                    <button class="btn btn-danger btn-excluir-pergunta">Excluir</button>
                </div>
            </article>

        `;
    }
}

listarPerguntas();

function listarOpcoesPerguntas(alternativasLista) {
    let itensHtml = '';

    for (let alternativa of alternativasLista) {
        itensHtml += ` <li class="chip">${alternativa}</li> `;
    }

    return itensHtml; // Retorna o texto dos <li> para o loop principal
}

function formatarTipo(tipo) {
    let tipos = {
        multipla_escolha: 'Múltipla escolha',
        texto_curto: 'Texto curto',
        texto_longo: 'Texto longo',
        checkbox: 'Checkbox'
    };

    return tipos[tipo];
}

// Mostra o bloco de alternativas só quando o tipo escolhido precisa delas,
// e explica o que acontece nos outros tipos (nenhum deles fica "sem função")
function verificarTipoPergunta() {
    let tipo = selectTipo.value;

    if (tipo === 'multipla_escolha' || tipo === 'checkbox') {
        wrapperAlternativas.style.display = 'block';
        infoTipo.textContent = '';
        garantirAlternativaMinima();
    } else if (tipo === 'texto_curto') {
        wrapperAlternativas.style.display = 'none';
        infoTipo.textContent = 'Essa pergunta será respondida com um texto curto (até 200 caracteres).';
    } else if (tipo === 'texto_longo') {
        wrapperAlternativas.style.display = 'none';
        infoTipo.textContent = 'Essa pergunta será respondida com um texto livre, sem limite de caracteres.';
    } else {
        wrapperAlternativas.style.display = 'none';
        infoTipo.textContent = '';
    }
}

selectTipo.addEventListener('change', verificarTipoPergunta);
verificarTipoPergunta();

// Cria uma linha de alternativa (usada ao adicionar, ao editar e ao garantir o mínimo)
function adicionarAlternativa(valor) {
    valor = valor || '';

    listaAlternativas.innerHTML += `
        <div class="alternativa-item">
            <input type="text" class="alternativa-input" placeholder="Texto da alternativa" value="${valor}">
            <button type="button" class="btn btn-danger btn-remover-alternativa">Remover</button>
        </div>
    `;
}

// Múltipla escolha e checkbox sempre precisam de ao menos 1 linha para digitar
function garantirAlternativaMinima() {
    if (listaAlternativas.querySelectorAll('.alternativa-item').length === 0) {
        adicionarAlternativa();
    }
}

btnAddAlternativa.addEventListener('click', function () {
    adicionarAlternativa();
});

// Delegação, já que os itens de alternativa são criados dinamicamente.
// Nunca remove a última linha: assim sempre sobra um campo para digitar.
listaAlternativas.addEventListener('click', function (evento) {
    if (!evento.target.classList.contains('btn-remover-alternativa')) return;

    let itens = listaAlternativas.querySelectorAll('.alternativa-item');

    if (itens.length > 1) {
        evento.target.parentElement.remove();
    } else {
        evento.target.parentElement.querySelector('.alternativa-input').value = '';
    }
});

function pegarAlternativas() {
    let inputs = listaAlternativas.querySelectorAll('.alternativa-input');
    let alternativas = [];

    for (let input of inputs) {
        if (input.value.trim() !== '') {
            alternativas.push(input.value.trim());
        }
    }

    return alternativas;
}

// Regras da seção 3 do enunciado: quantidade mínima/máxima de alternativas e sem repetição
function validarAlternativas(tipo, alternativas) {
    if (tipo === 'multipla_escolha' && (alternativas.length < 2 || alternativas.length > 10)) {
        return 'Múltipla escolha precisa ter entre 2 e 10 alternativas.';
    }

    if (tipo === 'checkbox' && (alternativas.length < 3 || alternativas.length > 15)) {
        return 'Checkbox precisa ter entre 3 e 15 alternativas.';
    }

    let alternativasSemRepeticao = new Set(alternativas.map(a => a.toLowerCase()));
    if (alternativasSemRepeticao.size !== alternativas.length) {
        return 'As alternativas não podem se repetir.';
    }

    return null;
}

// Regra 4.4/4.7: verifica se a pergunta já foi usada em alguma resposta enviada
async function perguntaFoiRespondida(id) {
    let resposta = await fetch(`${URL_API}/respostas`);
    let respostas = await resposta.json();

    return respostas.some(r => r.respostas.some(item => item.perguntaId === id));
}

formPergunta.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    mensagemErro.textContent = '';

    let enunciado = inputEnunciado.value.trim();
    let tipo = selectTipo.value;
    let alternativas = (tipo === 'multipla_escolha' || tipo === 'checkbox') ? pegarAlternativas() : [];

    if (enunciado === '') {
        mensagemErro.textContent = 'O enunciado não pode ser vazio.';
        return;
    }

    let tiposValidos = ['multipla_escolha', 'texto_curto', 'texto_longo', 'checkbox'];
    if (!tiposValidos.includes(tipo)) {
        mensagemErro.textContent = 'Selecione um tipo de pergunta válido.';
        return;
    }

    let erroAlternativas = validarAlternativas(tipo, alternativas);
    if (erroAlternativas) {
        mensagemErro.textContent = erroAlternativas;
        return;
    }

    // Regra 4.8: pergunta já respondida não pode ter o tipo ou as alternativas alterados
    if (inputId.value !== '' && perguntaEmEdicao) {
        let mudouTipoOuAlternativas = tipo !== perguntaEmEdicao.tipo
            || JSON.stringify(alternativas) !== JSON.stringify(perguntaEmEdicao.alternativas);

        if (mudouTipoOuAlternativas && await perguntaFoiRespondida(inputId.value)) {
            mensagemErro.textContent = 'Essa pergunta já foi respondida: não é possível alterar o tipo ou as alternativas dela.';
            return;
        }
    }

    let pergunta = {
        enunciado: enunciado,
        tipo: tipo,
        obrigatoria: inputObrigatoria.checked,
        alternativas: alternativas,
        criadaEm: new Date().toISOString()
    };

    if (inputId.value === '') {
        await fetch(`${URL_API}/perguntas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pergunta)
        });
    } else {
        await fetch(`${URL_API}/perguntas/${inputId.value}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pergunta)
        });
    }

    limparFormulario();
    listarPerguntas();
});

btnCancelar.addEventListener('click', limparFormulario);

function limparFormulario() {
    inputId.value = '';
    perguntaEmEdicao = null;
    formPergunta.reset();
    mensagemErro.textContent = '';

    listaAlternativas.innerHTML = '';
    adicionarAlternativa();

    verificarTipoPergunta();
}

// Delegação, já que os cards de pergunta são recriados a cada listarPerguntas()
secaoPerguntas.addEventListener('click', async function (evento) {
    let card = evento.target.closest('.pergunta-card');
    if (!card) return;

    let id = card.dataset.id;

    if (evento.target.classList.contains('btn-excluir-pergunta')) {
        // Regra 4.7: pergunta já respondida não pode ser excluída fisicamente
        if (await perguntaFoiRespondida(id)) {
            alert('Essa pergunta já possui respostas vinculadas e não pode ser excluída.');
            return;
        }

        await fetch(`${URL_API}/perguntas/${id}`, {
            method: "DELETE"
        });

        listarPerguntas();
    }

    if (evento.target.classList.contains('btn-editar-pergunta')) {
        let resposta = await fetch(`${URL_API}/perguntas/${id}`);
        let pergunta = await resposta.json();

        perguntaEmEdicao = pergunta;
        inputId.value = pergunta.id;
        inputEnunciado.value = pergunta.enunciado;
        selectTipo.value = pergunta.tipo;
        inputObrigatoria.checked = pergunta.obrigatoria;

        listaAlternativas.innerHTML = '';

        for (let alternativa of pergunta.alternativas) {
            adicionarAlternativa(alternativa);
        }

        verificarTipoPergunta();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
