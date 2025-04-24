document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.menu-item');
    const submenuLinks = document.querySelectorAll('.submenu a');
    const contentViews = document.querySelectorAll('.content-view');
    const body = document.body;

    // CNPJ Individual
    const cnpjInputIndividual = document.getElementById('cnpjInputIndividual');
    const consultarBtnIndividual = document.getElementById('consultarBtnIndividual');
    const resultadoIndividualDiv = document.getElementById('resultadoIndividual');
    const statusIndividualDiv = document.getElementById('statusIndividual');

    // CNPJ Excel
    const excelFileInput = document.getElementById('excelFile');
    const processExcelBtn = document.getElementById('processExcelBtn');
    const statusExcelDiv = document.getElementById('statusExcel');
    const resultsExcelCard = document.getElementById('resultsExcelCard');
    const cnpjResultsTbody = document.getElementById('cnpjResultsTbody');
    const loadingExcel = document.getElementById('loadingExcel');
    const filterInputs = document.querySelectorAll('#table-controls .filter-input');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const cnpjResultsTable = document.getElementById('cnpjResultsTable'); // Tabela para delegação

    // NCM Individual
    const ncmInputIndividual = document.getElementById('ncmInputIndividual');
    const consultarNcmBtnIndividual = document.getElementById('consultarNcmBtnIndividual');
    const resultadoNcmIndividualDiv = document.getElementById('resultadoNcmIndividual');
    const statusNcmIndividualDiv = document.getElementById('statusNcmIndividual');

    // Modal
    const modal = document.getElementById('modal-cnpj-details');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = modal.querySelector('.close-button');
    const loadingModal = document.getElementById('loadingModal');

    // Estado da Aplicação
    let activeSubmenu = null;
    let activeViewId = 'view-cnpj-individual'; // View inicial

    // --- Constantes e Configurações ---
    const BRASIL_API_BASE = 'https://brasilapi.com.br/api';
    const NOME_MAX_LENGTH = 35; // Máximo de caracteres para nome na tabela

    // --- Funções Auxiliares ---

    // Limpa mensagens de status
    function clearStatus(element) {
        if(element) {
            element.innerHTML = '';
            element.className = 'status-message'; // Reseta classes
            element.style.display = 'none';
        }
    }

    // Mostra mensagem de status (loading, error, success)
    function showStatus(element, message, type = 'loading') {
         if(element) {
            element.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-spinner fa-spin'}"></i> ${message}`;
            element.className = `status-message ${type}`; // Adiciona classe do tipo
            element.style.display = 'block';
         }
    }

    // Formata CNPJ: XX.XXX.XXX/XXXX-XX
    function formatarCNPJ(cnpj) {
        if (!cnpj) return '';
        const cleaned = cnpj.replace(/\D+/g, '');
        if (cleaned.length !== 14) return cnpj; // Retorna original se inválido
        return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }

     // Formata NCM: XXXX.XX.XX (se tiver 8 digitos)
    function formatarNCM(ncm) {
        if (!ncm) return '';
        const cleaned = ncm.replace(/\D+/g, '');
        if (cleaned.length === 8) {
             return cleaned.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3");
        }
        return ncm; // Retorna original se não tiver 8 digitos
    }


    // Formata número como moeda BRL
    function formatarMoeda(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) return 'N/A';
        return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Verifica se a atividade (CNAE) é atacadista
    function isAtacadista(descricaoCnae) {
        if (!descricaoCnae) return false;
        const descLower = descricaoCnae.toLowerCase();
        return descLower.includes('atacadista') || descLower.includes('comércio por atacado');
    }

    // Cria o HTML para exibir detalhes do CNPJ (reutilizável para individual e modal)
    function criarHtmlDetalhesCnpj(data) {
        if (!data || !data.cnpj) {
            return '<p class="na">Dados não encontrados.</p>';
        }

        const temAtividadePrincipal = data.cnae_fiscal_descricao;
        const eAtacadistaPrincipal = temAtividadePrincipal ? isAtacadista(data.cnae_fiscal_descricao) : false;

        let eAtacadistaSecundaria = false;
        let cnaesSecundariosHtml = '<p><strong>Atividades Secundárias:</strong> <span class="na">Nenhuma</span></p>';
        if (data.cnaes_secundarios && data.cnaes_secundarios.length > 0) {
            cnaesSecundariosHtml = '<p><strong>Atividades Secundárias:</strong></p><ul style="margin-top: -10px; margin-bottom: 10px; padding-left: 25px; list-style: disc;">';
            data.cnaes_secundarios.forEach(cnae => {
                const desc = cnae.descricao || 'Descrição não disponível';
                if (isAtacadista(desc)) {
                    eAtacadistaSecundaria = true;
                }
                cnaesSecundariosHtml += `<li>${cnae.codigo || ''} - ${desc} ${isAtacadista(desc) ? '<strong style="color:green;">(Atacadista)</strong>' : ''}</li>`;
            });
            cnaesSecundariosHtml += '</ul>';
             // Adiciona borda no último item da lista se houver
             cnaesSecundariosHtml = cnaesSecundariosHtml.replace(/<\/li>(?!.*<\/li>)/, '</li><p style="border:none; margin:0; padding:0;"></p>');
        } else {
             cnaesSecundariosHtml += '<p style="border:none; margin:0; padding:0;"></p>'; // Para manter a estrutura do último p sem borda
        }

        const temAtividadeAtacadistaGeral = eAtacadistaPrincipal || eAtacadistaSecundaria;

        return `
            <p><strong>CNPJ:</strong> ${formatarCNPJ(data.cnpj)}</p>
            <p><strong>Razão Social:</strong> ${data.razao_social || '<span class="na">N/A</span>'}</p>
            <p><strong>Nome Fantasia:</strong> ${data.nome_fantasia || '<span class="na">N/A</span>'}</p>
            <p><strong>Situação Cadastral:</strong> ${data.descricao_situacao_cadastral || '<span class="na">N/A</span>'} (${data.data_situacao_cadastral || 'N/A'})</p>
            ${data.descricao_motivo_situacao_cadastral && data.descricao_motivo_situacao_cadastral !== 'SEM MOTIVO' ? `<p><strong>Motivo Situação:</strong> ${data.descricao_motivo_situacao_cadastral}</p>` : ''}
            <hr>
            <p><strong>Atividade Principal (CNAE):</strong> ${data.cnae_fiscal || '<span class="na">N/A</span>'} - ${data.cnae_fiscal_descricao || '<span class="na">N/A</span>'} <span class="${eAtacadistaPrincipal ? 'sim' : 'nao'}">(${eAtacadistaPrincipal ? 'É Atacadista' : 'Não é Atacadista'})</span></p>
            <p><strong>Natureza Jurídica:</strong> ${data.codigo_natureza_juridica || ''} - ${data.natureza_juridica || '<span class="na">N/A</span>'}</p>
            <hr>
            <p><strong>Endereço:</strong></p>
            <p style="padding-left: 15px; border: none; margin-top: -10px;">
                ${data.logradouro || 'N/A'}, ${data.numero || 'S/N'} ${data.complemento ? `- ${data.complemento}` : ''}<br>
                ${data.bairro || 'N/A'} - CEP: ${data.cep || 'N/A'}<br>
                ${data.municipio || 'N/A'} - ${data.uf || 'N/A'}
            </p>
            <hr>
            <p><strong>Telefone:</strong> ${data.ddd_telefone_1 || '<span class="na">N/A</span>'} ${data.ddd_telefone_2 ? ` / ${data.ddd_telefone_2}` : ''}</p>
            <p><strong>E-mail:</strong> ${data.email || '<span class="na">N/A</span>'}</p>
            <p><strong>Capital Social:</strong> ${formatarMoeda(data.capital_social)}</p>
            <p><strong>Porte:</strong> ${data.descricao_porte || '<span class="na">N/A</span>'}</p>
            <hr>
            ${cnaesSecundariosHtml}
             <p style="border:none; padding-bottom: 0; margin-bottom: 0;"><strong>Possui Atividade Atacadista (Principal ou Secundária)?</strong> <span class="${temAtividadeAtacadistaGeral ? 'sim' : 'nao'}">${temAtividadeAtacadistaGeral ? 'SIM' : 'NÃO'}</span></p>
        `;
    }

     // Cria o HTML para exibir detalhes do NCM
    function criarHtmlDetalhesNcm(data) {
        if (!data || !data.codigo) {
            return '<p class="na">Dados não encontrados.</p>';
        }

        let aliquotasHtml = '<p><strong>Alíquotas:</strong> <span class="na">Nenhuma informada</span></p>';
        if (data.aliquotas && (data.aliquotas.ipi || data.aliquotas.pis_cofins)) {
             aliquotasHtml = '<p><strong>Alíquotas:</strong></p><ul style="margin-top: -10px; margin-bottom: 10px; padding-left: 25px; list-style: disc;">';
             if(data.aliquotas.ipi) {
                 aliquotasHtml += `<li>IPI: ${data.aliquotas.ipi.aliquota}% ${data.aliquotas.ipi.excecao ? `(Exceção: ${data.aliquotas.ipi.excecao})` : ''}</li>`;
             }
              if(data.aliquotas.pis_cofins) {
                 aliquotasHtml += `<li>PIS/COFINS: Entrada: ${data.aliquotas.pis_cofins.entrada}% / Saída: ${data.aliquotas.pis_cofins.saida}% ${data.aliquotas.pis_cofins.excecao ? `(Exceção: ${data.aliquotas.pis_cofins.excecao})` : ''}</li>`;
             }
             // Adicionar outras alíquotas se a API retornar
             aliquotasHtml += '</ul><p style="border:none; margin:0; padding:0;"></p>';
        } else {
             aliquotasHtml += '<p style="border:none; margin:0; padding:0;"></p>';
        }


        return `
            <p><strong>NCM:</strong> ${formatarNCM(data.codigo)}</p>
            <p><strong>Descrição:</strong> ${data.descricao || '<span class="na">N/A</span>'}</p>
            <p><strong>Data Início Vigência:</strong> ${data.data_inicio || '<span class="na">N/A</span>'}</p>
            <p><strong>Data Fim Vigência:</strong> ${data.data_fim || '<span class="na">N/A</span>'}</p>
            <p><strong>Ato Legal:</strong> ${data.ato_legal || '<span class="na">N/A</span>'}</p>
            <hr>
            ${aliquotasHtml}
        `;
    }


    // --- Funções de Lógica da Interface ---

    // Controla expansão/colapso da sidebar no hover
    function handleSidebarHover() {
        sidebar.addEventListener('mouseenter', () => {
            // sidebar.classList.add('expanded'); // Opcional se :hover for suficiente
            body.classList.add('sidebar-expanded');
        });
        sidebar.addEventListener('mouseleave', () => {
            // sidebar.classList.remove('expanded'); // Opcional
            body.classList.remove('sidebar-expanded');
        });
    }

    // Controla abertura/fechamento dos submenus
    function handleSubmenuToggle() {
        menuItems.forEach(item => {
            const link = item.querySelector('a.menu-item');
            const submenu = item.querySelector('.submenu');

            if (link && submenu) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Fecha o submenu ativo anteriormente, se for diferente do clicado
                    if (activeSubmenu && activeSubmenu !== submenu) {
                        activeSubmenu.classList.remove('open');
                         activeSubmenu.previousElementSibling.classList.remove('active'); // Remove classe ativa do link pai anterior
                    }

                    // Abre/fecha o submenu atual
                    submenu.classList.toggle('open');
                    link.classList.toggle('active'); // Adiciona/remove classe ativa no link pai


                    // Atualiza o submenu ativo
                    activeSubmenu = submenu.classList.contains('open') ? submenu : null;
                });
            }
        });
    }

    // Mostra a view de conteúdo selecionada
    function showView(viewId) {
        contentViews.forEach(view => {
            view.classList.remove('active');
            if (view.id === viewId) {
                view.classList.add('active');
            }
        });
        activeViewId = viewId;
        // Opcional: rolar para o topo da nova view
        // mainContent.scrollTop = 0;
        // window.scrollTo(0, 0);
    }

    // Navegação pelas views
    function handleViewNavigation() {
        submenuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetViewId = `view-${link.getAttribute('data-view')}`;

                // Remove classe 'active' de todos os links de submenu
                 submenuLinks.forEach(sl => sl.classList.remove('active'));
                 // Adiciona classe 'active' ao link clicado
                 link.classList.add('active');

                showView(targetViewId);
            });
        });
    }

     // Controla o Modal
    function handleModal() {
        // Fecha ao clicar no X
        closeModalBtn.addEventListener('click', closeModal);
        // Fecha ao clicar fora do conteúdo do modal
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    function openModal() {
        modal.style.display = 'flex';
        // Adiciona classe ao body para travar scroll (opcional)
        // document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        modalBody.innerHTML = ''; // Limpa conteúdo anterior
        loadingModal.style.display = 'none';
         // Restaura scroll do body (opcional)
        // document.body.style.overflow = '';
    }

    // --- Funções de Consulta API ---

    // Função genérica para buscar dados da BrasilAPI
    async function fetchData(endpoint) {
        const url = `${BRASIL_API_BASE}/${endpoint}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Erro ${response.status}: ${response.statusText} ao buscar ${url}`);
                 if (response.status === 404) {
                     throw new Error('NotFound'); // Erro específico para 404
                 }
                 throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Falha na requisição fetch:", error);
            throw error; // Re-lança o erro para ser tratado onde a função foi chamada
        }
    }

    // --- Lógica Específica: CNPJ Individual ---

    async function consultarCnpjIndividual() {
        const cnpj = cnpjInputIndividual.value.replace(/\D+/g, '');
        clearStatus(statusIndividualDiv);
        resultadoIndividualDiv.innerHTML = '';

        if (cnpj.length !== 14) {
            showStatus(statusIndividualDiv, 'CNPJ inválido. Digite 14 números.', 'error');
            return;
        }

        showStatus(statusIndividualDiv, 'Consultando CNPJ...', 'loading');

        try {
            const data = await fetchData(`cnpj/v1/${cnpj}`);
            clearStatus(statusIndividualDiv);
            resultadoIndividualDiv.innerHTML = criarHtmlDetalhesCnpj(data);
            resultadoIndividualDiv.style.display = 'block'; // Garante que a div de resultado esteja visível
        } catch (error) {
             if (error.message === 'NotFound') {
                 showStatus(statusIndividualDiv, 'CNPJ não encontrado na base de dados.', 'error');
            } else {
                 showStatus(statusIndividualDiv, 'Erro ao consultar. Verifique a conexão ou tente mais tarde.', 'error');
            }
            resultadoIndividualDiv.style.display = 'none';
        }
    }

    // --- Lógica Específica: NCM Individual ---
     async function consultarNcmIndividual() {
        const ncm = ncmInputIndividual.value.replace(/\D+/g, '');
        clearStatus(statusNcmIndividualDiv);
        resultadoNcmIndividualDiv.innerHTML = '';

        if (ncm.length < 2 || ncm.length > 8) { // NCM pode ter de 2 a 8 digitos na API
            showStatus(statusNcmIndividualDiv, 'NCM inválido. Digite de 2 a 8 números.', 'error');
            return;
        }

        showStatus(statusNcmIndividualDiv, 'Consultando NCM...', 'loading');

        try {
            // A API NCM pode retornar um array se o código for genérico (ex: capítilo)
            // ou um objeto se for específico. Tratamos ambos.
            const data = await fetchData(`ncm/v1/${ncm}`);

            clearStatus(statusNcmIndividualDiv);

            if (Array.isArray(data)) {
                // Se for um array, mostramos uma lista (ou o primeiro resultado?)
                // Por simplicidade, mostraremos o primeiro se houver
                if (data.length > 0) {
                     resultadoNcmIndividualDiv.innerHTML = criarHtmlDetalhesNcm(data[0]);
                     if (data.length > 1) {
                          resultadoNcmIndividualDiv.innerHTML += `<p style="margin-top:15px; font-style:italic; color:#555;">Nota: Código NCM genérico, mais resultados existem (${data.length} no total).</p>`;
                     }
                } else {
                    showStatus(statusNcmIndividualDiv, 'NCM não encontrado.', 'error');
                    resultadoNcmIndividualDiv.style.display = 'none';
                    return;
                }
            } else if (typeof data === 'object' && data !== null && data.codigo) {
                // Se for um objeto com código, mostra os detalhes
                 resultadoNcmIndividualDiv.innerHTML = criarHtmlDetalhesNcm(data);
            } else {
                 // Caso inesperado
                 throw new Error('Formato de resposta inesperado da API NCM.');
            }

            resultadoNcmIndividualDiv.style.display = 'block';

        } catch (error) {
             if (error.message === 'NotFound') {
                 showStatus(statusNcmIndividualDiv, 'NCM não encontrado na base de dados.', 'error');
            } else {
                 showStatus(statusNcmIndividualDiv, 'Erro ao consultar NCM. Verifique a conexão ou tente mais tarde.', 'error');
            }
            resultadoNcmIndividualDiv.style.display = 'none';
        }
    }


    // --- Lógica Específica: CNPJ Excel ---

    function handleExcelUpload() {
        excelFileInput.addEventListener('change', () => {
            if (excelFileInput.files.length > 0) {
                processExcelBtn.disabled = false;
                 // Opcional: mostrar nome do arquivo selecionado
                 // statusExcelDiv.innerHTML = `Arquivo selecionado: ${excelFileInput.files[0].name}`;
                 // statusExcelDiv.className = 'status-message info';
                 // statusExcelDiv.style.display = 'block';
                 clearStatus(statusExcelDiv); // Limpa status anterior
            } else {
                processExcelBtn.disabled = true;
            }
        });

        processExcelBtn.addEventListener('click', processExcelFile);
    }

    function processExcelFile() {
        const file = excelFileInput.files[0];
        if (!file) {
            showStatus(statusExcelDiv, 'Nenhum arquivo selecionado.', 'error');
            return;
        }

        resultsExcelCard.style.display = 'none'; // Esconde resultados anteriores
        cnpjResultsTbody.innerHTML = ''; // Limpa tabela
        showStatus(statusExcelDiv, 'Lendo arquivo Excel...', 'loading');
        loadingExcel.style.display = 'block';
        processExcelBtn.disabled = true; // Desabilita enquanto processa

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Lê como array de arrays

                // Extrai CNPJs da coluna A (índice 0), ignorando cabeçalho (linha 0)
                const cnpjs = jsonData
                    .slice(1) // Pula a linha do cabeçalho (A1)
                    .map(row => row[0]) // Pega o valor da primeira coluna
                    .filter(cnpj => cnpj && String(cnpj).replace(/\D+/g, '').length === 14) // Filtra válidos
                    .map(cnpj => String(cnpj).replace(/\D+/g, '')); // Limpa e garante string

                // Remove duplicados
                const uniqueCnpjs = [...new Set(cnpjs)];

                if (uniqueCnpjs.length === 0) {
                    showStatus(statusExcelDiv, 'Nenhum CNPJ válido encontrado na coluna A (a partir de A2).', 'error');
                    loadingExcel.style.display = 'none';
                    processExcelBtn.disabled = false;
                    return;
                }

                showStatus(statusExcelDiv, `Encontrados ${uniqueCnpjs.length} CNPJs únicos. Consultando dados...`, 'loading');

                // Busca dados para cada CNPJ em paralelo
                const promises = uniqueCnpjs.map(cnpj =>
                    fetchData(`cnpj/v1/${cnpj}`)
                        .then(data => ({ status: 'fulfilled', value: data, cnpj: cnpj })) // Sucesso
                        .catch(error => ({ status: 'rejected', reason: error, cnpj: cnpj })) // Falha
                );

                const results = await Promise.allSettled(promises); // Espera todas as consultas

                clearStatus(statusExcelDiv); // Limpa mensagem de "Consultando..."
                loadingExcel.style.display = 'none';
                displayExcelResults(results); // Mostra os resultados na tabela
                resultsExcelCard.style.display = 'block'; // Mostra o card da tabela

            } catch (error) {
                console.error("Erro ao processar o arquivo Excel:", error);
                showStatus(statusExcelDiv, 'Erro ao ler ou processar o arquivo Excel.', 'error');
                loadingExcel.style.display = 'none';
            } finally {
                 processExcelBtn.disabled = false; // Reabilita botão
                 excelFileInput.value = ''; // Limpa seleção do input file
            }
        };

        reader.onerror = () => {
            console.error("Erro ao ler o arquivo.");
            showStatus(statusExcelDiv, 'Não foi possível ler o arquivo selecionado.', 'error');
            loadingExcel.style.display = 'none';
            processExcelBtn.disabled = false;
             excelFileInput.value = '';
        };

        reader.readAsArrayBuffer(file); // Inicia a leitura
    }

    function displayExcelResults(results) {
        cnpjResultsTbody.innerHTML = ''; // Limpa tabela

        results.forEach(result => {
            const tr = document.createElement('tr');
            const cnpjOriginal = result.status === 'fulfilled' ? result.value.cnpj : result.reason.cnpj; // Pega o CNPJ original

            if (result.status === 'fulfilled' && result.value) {
                const data = result.value;

                // Determinar nome a exibir (Fantasia ou Razão Social) e truncar
                let nomeExibicao = data.nome_fantasia || data.razao_social || 'Nome Indisponível';
                const nomeCompleto = nomeExibicao; // Guarda nome completo para tooltip
                if (nomeExibicao.length > NOME_MAX_LENGTH) {
                    nomeExibicao = nomeExibicao.substring(0, NOME_MAX_LENGTH) + '...';
                }

                const eAtacadistaPrincipal = isAtacadista(data.cnae_fiscal_descricao);
                let eAtacadistaSecundaria = false;
                if (data.cnaes_secundarios && data.cnaes_secundarios.length > 0) {
                    eAtacadistaSecundaria = data.cnaes_secundarios.some(cnae => isAtacadista(cnae.descricao));
                }
                const temAtividadeAtacadistaGeral = eAtacadistaPrincipal || eAtacadistaSecundaria;

                tr.innerHTML = `
                    <td>${formatarCNPJ(data.cnpj)}</td>
                    <td title="${nomeCompleto}">${nomeExibicao}</td>
                    <td><span class="${temAtividadeAtacadistaGeral ? 'sim' : 'nao'}">${temAtividadeAtacadistaGeral ? 'SIM' : 'NÃO'}</span></td>
                    <td><span class="${eAtacadistaPrincipal ? 'sim' : 'nao'}">${eAtacadistaPrincipal ? 'SIM' : 'NÃO'}</span></td>
                    <td><span class="${eAtacadistaSecundaria ? 'sim' : 'nao'}">${eAtacadistaSecundaria ? 'SIM' : 'NÃO'}</span></td>
                    <td>${data.uf || '<span class="na">N/A</span>'}</td>
                    <td>
                        <button class="info-btn" data-cnpj="${data.cnpj}" title="Ver Detalhes">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </td>
                `;
            } else {
                 // CNPJ não encontrado ou erro na API
                 const errorMessage = result.reason && result.reason.message === 'NotFound'
                    ? 'Não encontrado'
                    : 'Erro consulta';
                tr.innerHTML = `
                    <td>${formatarCNPJ(cnpjOriginal)}</td>
                    <td colspan="5" style="color: var(--error-color); font-style: italic;">${errorMessage}</td>
                    <td></td>
                `;
                tr.style.opacity = '0.7'; // Indica visualmente que deu erro
            }
            cnpjResultsTbody.appendChild(tr);
        });

         // Adiciona listener para os botões de info DEPOIS que a tabela for populada
         // Usando delegação de eventos na tabela é mais eficiente
         // O listener já está configurado na inicialização geral
    }


    // --- Lógica de Filtragem da Tabela ---

    function handleTableFiltering() {
        filterInputs.forEach(input => {
            input.addEventListener('keyup', applyTableFilters); // 'keyup' para resposta rápida
             if(input.tagName === 'SELECT') {
                 input.addEventListener('change', applyTableFilters); // para selects
             }
        });

        clearFiltersBtn.addEventListener('click', () => {
             filterInputs.forEach(input => {
                input.value = ''; // Limpa valor
             });
            applyTableFilters(); // Reaplica filtros (que agora estarão vazios)
        });
    }

    function applyTableFilters() {
        const filters = {};
        filterInputs.forEach(input => {
            const columnIndex = input.getAttribute('data-column');
            filters[columnIndex] = input.value.trim().toLowerCase();
        });

        const rows = cnpjResultsTbody.querySelectorAll('tr');
        rows.forEach(row => {
            let visible = true;
            const cells = row.querySelectorAll('td');

            for (const colIndex in filters) {
                if (filters[colIndex] === '') continue; // Ignora filtros vazios

                const cell = cells[colIndex];
                if (!cell || !cell.textContent) { // Se a célula não existir ou não tiver texto
                     visible = false;
                     break;
                }

                const cellText = cell.textContent.trim().toLowerCase();

                // Lógica especial para colunas SIM/NÃO (índices 2, 3, 4)
                 if (['2', '3', '4'].includes(colIndex)) {
                     const filterValue = filters[colIndex]; // 'sim' ou 'não'
                     if (filterValue === 'sim' && !cellText.includes('sim')) {
                         visible = false;
                         break;
                     }
                     if (filterValue === 'não' && !cellText.includes('não')) {
                          visible = false;
                          break;
                     }
                 } else {
                     // Filtro normal 'contains' para outras colunas
                     if (!cellText.includes(filters[colIndex])) {
                         visible = false;
                         break; // Não precisa checar outras colunas para esta linha
                     }
                 }
            }
            row.style.display = visible ? '' : 'none'; // Mostra ou esconde a linha
        });
    }

    // --- Lógica para Abrir Modal com Detalhes ---
    function handleInfoButtonClicks() {
         // Usar delegação de eventos no tbody da tabela
         cnpjResultsTable.addEventListener('click', async (event) => {
             const infoButton = event.target.closest('.info-btn'); // Encontra o botão clicado ou seu pai mais próximo

             if (infoButton) {
                 const cnpj = infoButton.getAttribute('data-cnpj');
                 if (cnpj) {
                     openModal();
                     loadingModal.style.display = 'block'; // Mostra loading no modal
                     modalBody.innerHTML = ''; // Limpa conteúdo anterior

                     try {
                         const data = await fetchData(`cnpj/v1/${cnpj}`);
                         modalBody.innerHTML = criarHtmlDetalhesCnpj(data);
                     } catch (error) {
                         modalBody.innerHTML = `<p class="status-message error"><i class="fas fa-exclamation-circle"></i> Erro ao carregar detalhes do CNPJ ${formatarCNPJ(cnpj)}.</p>`;
                         console.error("Erro ao buscar dados para o modal:", error);
                     } finally {
                          loadingModal.style.display = 'none'; // Esconde loading no modal
                     }
                 }
             }
         });
    }


    // --- Inicialização ---
    function init() {
        handleSidebarHover();
        handleSubmenuToggle();
        handleViewNavigation();
        handleModal();
        handleExcelUpload();
        handleTableFiltering();
        handleInfoButtonClicks(); // Configura o listener delegado para os botões de info

        // Listeners dos botões de consulta individual
        consultarBtnIndividual.addEventListener('click', consultarCnpjIndividual);
        cnpjInputIndividual.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') consultarCnpjIndividual();
        });

        consultarNcmBtnIndividual.addEventListener('click', consultarNcmIndividual);
        ncmInputIndividual.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') consultarNcmIndividual();
        });


        // Ativa a view inicial (opcional, já definida no HTML com a classe 'active')
        // showView(activeViewId);

        // Abre o primeiro submenu por padrão (opcional)
        const firstMenuItem = document.querySelector('.menu-item[data-menu="cnpj"]');
        // const firstSubmenu = firstMenuItem?.nextElementSibling;
        // if(firstMenuItem && firstSubmenu) {
        //     firstMenuItem.classList.add('active');
        //     firstSubmenu.classList.add('open');
        //     activeSubmenu = firstSubmenu;
        //     // Marca o primeiro item do submenu como ativo tbm (opcional)
        //     const firstSubmenuLink = firstSubmenu.querySelector('a');
        //     if (firstSubmenuLink) firstSubmenuLink.classList.add('active');
        // }
    }

    init(); // Executa a inicialização
});