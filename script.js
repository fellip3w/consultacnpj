// Seleciona os elementos do HTML
const cnpjInput = document.getElementById('cnpjInput');
const consultarBtn = document.getElementById('consultarBtn');
const resultadoDiv = document.getElementById('resultado');
const statusDiv = document.getElementById('status');

// Adiciona um ouvinte de evento para o clique no botão
consultarBtn.addEventListener('click', consultarCNPJ);

// Adiciona um ouvinte para a tecla Enter no campo de input
cnpjInput.addEventListener('keypress', function(event) {
    // Verifica se a tecla pressionada foi Enter (código 13)
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault(); // Impede o comportamento padrão do Enter (como submeter um formulário)
        consultarCNPJ(); // Chama a função de consulta
    }
});

// Função para limpar o campo de resultado e status
function limparResultados() {
    resultadoDiv.innerHTML = '';
    statusDiv.innerHTML = '';
}

// Função principal para consultar o CNPJ
async function consultarCNPJ() {
    // Pega o valor do CNPJ e remove caracteres não numéricos
    const cnpj = cnpjInput.value.replace(/\D+/g, ''); // Remove tudo que não for dígito

    // Limpa resultados anteriores e mensagens de status
    limparResultados();

    // Validação básica do CNPJ
    if (cnpj.length !== 14) {
        statusDiv.innerHTML = '<p class="error">CNPJ inválido. Deve conter 14 números.</p>';
        return; // Interrompe a função
    }

    // Mostra mensagem de carregamento
    statusDiv.innerHTML = '<p class="loading">Consultando...</p>';

    try {
        // Monta a URL da API
        const apiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;

        // Faz a requisição para a API usando fetch
        const response = await fetch(apiUrl);

        // Limpa a mensagem de carregamento
        statusDiv.innerHTML = '';

        // Verifica se a resposta da API foi bem-sucedida
        if (!response.ok) {
            // Se o status for 404 (Not Found), o CNPJ provavelmente não existe ou não foi encontrado
            if (response.status === 404) {
                 statusDiv.innerHTML = '<p class="error">CNPJ não encontrado na base de dados.</p>';
            } else {
                // Outros erros (servidor fora, limite excedido, etc.)
                statusDiv.innerHTML = `<p class="error">Erro ao consultar a API: ${response.status} ${response.statusText}</p>`;
            }
            return; // Interrompe a função
        }

        // Converte a resposta para JSON
        const data = await response.json();

        // Exibe os dados formatados
        exibirDados(data);

    } catch (error) {
        // Trata erros de rede ou outros problemas durante a consulta
        console.error("Erro na consulta:", error);
        statusDiv.innerHTML = '<p class="error">Não foi possível conectar à API. Verifique sua conexão ou tente mais tarde.</p>';
    }
}

// Função para exibir os dados formatados na tela
function exibirDados(data) {
    // Limpa a div de resultados antes de adicionar novos dados
    resultadoDiv.innerHTML = '';

    // Cria elementos HTML para mostrar cada informação
    // Usamos || '' para mostrar uma string vazia caso o campo não exista nos dados da API

    resultadoDiv.innerHTML = `
        <p><strong>CNPJ:</strong> ${formatarCNPJ(data.cnpj || '')}</p>
        <p><strong>Razão Social:</strong> ${data.razao_social || 'N/A'}</p>
        <p><strong>Nome Fantasia:</strong> ${data.nome_fantasia || 'N/A'}</p>
        <p><strong>Situação Cadastral:</strong> ${data.descricao_situacao_cadastral || 'N/A'}</p>
        <p><strong>Data Situação Cadastral:</strong> ${data.data_situacao_cadastral || 'N/A'}</p>
        <p><strong>Motivo Situação Cadastral:</strong> ${data.descricao_motivo_situacao_cadastral || 'N/A'}</p>
        <hr>
        <p><strong>Atividade Principal (CNAE):</strong> ${data.cnae_fiscal || 'N/A'} - ${data.cnae_fiscal_descricao || 'N/A'}</p>
        <p><strong>Natureza Jurídica:</strong> ${data.natureza_juridica || 'N/A'}</p>
        <hr>
        <p><strong>Endereço:</strong></p>
        <p style="padding-left: 15px;">
            ${data.logradouro || 'N/A'}, ${data.numero || 'S/N'} ${data.complemento ? '- ' + data.complemento : ''}<br>
            ${data.bairro || 'N/A'} - CEP: ${data.cep || 'N/A'}<br>
            ${data.municipio || 'N/A'} - ${data.uf || 'N/A'}
        </p>
        <hr>
        <p><strong>Telefone:</strong> ${data.ddd_telefone_1 || 'N/A'}</p>
        <p><strong>E-mail:</strong> ${data.email || 'N/A'}</p>
        <p><strong>Capital Social:</strong> R$ ${formatarNumero(data.capital_social) || 'N/A'}</p>
        <hr>
        <p><strong>Tipo (Inferido pela Atividade Principal):</strong> ${verificarTipo(data.cnae_fiscal_descricao)}</p>
    `;

    // Se houver CNAEs secundários, exibe-os
    if (data.cnaes_secundarios && data.cnaes_secundarios.length > 0) {
        let cnaesSecundariosHtml = '<p><strong>Atividades Secundárias:</strong></p><ul style="padding-left: 30px;">';
        data.cnaes_secundarios.forEach(cnae => {
            cnaesSecundariosHtml += `<li>${cnae.codigo || ''} - ${cnae.descricao || ''}</li>`;
        });
        cnaesSecundariosHtml += '</ul>';
        resultadoDiv.innerHTML += cnaesSecundariosHtml;
    }
}

// Função para verificar se é atacadista baseado na descrição do CNAE principal
function verificarTipo(descricaoCnae) {
    if (!descricaoCnae) return 'Não informado'; // Retorna se não houver descrição

    const descLower = descricaoCnae.toLowerCase(); // Converte para minúsculas para facilitar a comparação

    if (descLower.includes('atacadista') || descLower.includes('comércio por atacado')) {
        return '<strong style="color: green;">Atacadista</strong>';
    } else if (descLower.includes('varejista') || descLower.includes('comércio varejista')) {
         return '<strong style="color: blue;">Varejista</strong>';
    } else if (descLower.includes('indústria') || descLower.includes('fabricação')) {
        return '<strong style="color: orange;">Indústria</strong>';
    } else if (descLower.includes('serviço')) {
         return '<strong style="color: purple;">Serviços</strong>';
    }
    // Você pode adicionar mais verificações aqui para outros tipos (serviços, indústria, etc.)

    return 'Outro (Verificar CNAE)'; // Caso não se encaixe nas categorias acima
}

// Função simples para formatar o CNPJ (XX.XXX.XXX/XXXX-XX)
function formatarCNPJ(cnpj) {
    if (!cnpj || cnpj.length !== 14) return cnpj; // Retorna original se inválido
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// Função para formatar números como moeda (simples)
function formatarNumero(valor) {
    if (valor === null || valor === undefined) return 'N/A';
    // Converte para número e formata com separadores de milhar e duas casas decimais
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}