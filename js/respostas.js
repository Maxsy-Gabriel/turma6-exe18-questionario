const URL_API = 'http://localhost:3000';

let selectFormulario = document.getElementById('select-formulario-respostas');
let secaoRespostas = document.getElementById('lista-respostas');

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
        await listarRespostas(selectFormulario.value);
    }
}

listarFormulariosSelect();

selectFormulario.addEventListener('change', function () {
    listarRespostas(selectFormulario.value);
});

function formatarDataHora(dataIso) {
    let data = new Date(dataIso);
    let dataFormatada = data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    let horaFormatada = data.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });

    return `Enviado em ${dataFormatada} às ${horaFormatada}`;
}

function formatarValor(valor) {
    return Array.isArray(valor) ? valor.join(', ') : valor;
}

async function listarRespostas(formularioId) {
    secaoRespostas.innerHTML = '';

    let respostaPerguntas = await fetch(`${URL_API}/perguntas`);
    let perguntas = await respostaPerguntas.json();

    // Filtra no cliente: a query ?formularioId= não é confiável nessa versão do json-server
    // quando o valor guardado (string) "parece" um número (ex.: "1", "2").
    let resposta = await fetch(`${URL_API}/respostas`);
    let todasRespostas = await resposta.json();
    let respostas = todasRespostas.filter(r => r.formularioId === formularioId);

    if (respostas.length === 0) {
        secaoRespostas.innerHTML = '<p>Nenhuma resposta recebida ainda para esse formulário.</p>';
        return;
    }

    for (let item of respostas) {
        let itensHtml = '';

        for (let detalhe of item.respostas) {
            let pergunta = perguntas.find(p => p.id === detalhe.perguntaId);
            let enunciado = pergunta ? pergunta.enunciado : 'Pergunta removida';

            itensHtml += `<li><strong>${enunciado}</strong> ${formatarValor(detalhe.valor)}</li>`;
        }

        secaoRespostas.innerHTML += `

            <article class="card resposta-card" data-id="${item.id}">
                <div class="card-header">
                    <span class="resposta-nome">${item.nome}</span>
                    <span class="resposta-email">${item.email}</span>
                </div>
                <p class="resposta-data">${formatarDataHora(item.enviadoEm)}</p>
                <ul class="resposta-detalhes">
                    ${itensHtml}
                </ul>
            </article>

        `;
    }
}
