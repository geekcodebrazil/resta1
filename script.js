/**
 * script.js
 * Lógica principal para o jogo Resta 1 (Peg Solitaire) - Geek Code Edition
 */

// --- Constantes e Variáveis Globais ---
const boardElement = document.getElementById('game-board');
const statusMessage = document.getElementById('status-message');
const moveHistoryList = document.getElementById('move-history-list');
const resetButton = document.getElementById('reset-button');
const startNoHintsButton = document.getElementById('start-no-hints-button');
const startWithHintsButton = document.getElementById('start-with-hints-button');
const viewHistoryButton = document.getElementById('view-history-button');

// Elementos do Modal
const modalOverlay = document.getElementById('modal-overlay');
const pastGamesModal = document.getElementById('past-games-modal');
const closeModalButton = document.getElementById('close-modal-button');
const pastGamesList = document.getElementById('past-games-list');
const selectedGameDetails = document.getElementById('selected-game-details');
const selectedGameMovesTextArea = document.getElementById('selected-game-moves');
const copySequenceButton = document.getElementById('copy-sequence-button');

// Configurações do Tabuleiro
const BOARD_SIZE = 7;
const INVALID_CELLS = [ // Coordenadas (linha, coluna) das células inválidas (0-indexed)
    [0, 0], [0, 1], [1, 0], [1, 1],
    [0, 5], [0, 6], [1, 5], [1, 6],
    [5, 0], [5, 1], [6, 0], [6, 1],
    [5, 5], [5, 6], [6, 5], [6, 6]
];
const CENTER_CELL = { row: 3, col: 3 }; // Centro do tabuleiro

// --- Sequência da Solução para o Modo Com Dicas (NÃO MODIFICAR) ---
const correctSolutionSteps = [
    // Formato: [fromRow, fromCol, toRow, toCol]
    [5, 3, 3, 3], [4, 1, 4, 3], [2, 1, 4, 1], [4, 0, 4, 2], [2, 0, 4, 0],
    [4, 3, 4, 1], [4, 0, 4, 2], [2, 3, 2, 1], [0, 2, 2, 2], [0, 4, 0, 2],
    [1, 4, 1, 2], [2, 1, 2, 3], [0, 2, 2, 2], [4, 5, 4, 3], [6, 4, 4, 4],
    [6, 2, 6, 4], [3, 4, 5, 4], [6, 4, 4, 4], [4, 3, 4, 5], [4, 6, 4, 4],
    [3, 6, 3, 4], [3, 4, 1, 4], [2, 6, 2, 4], [1, 4, 3, 4], [3, 2, 1, 2],
    [5, 2, 3, 2], [4, 4, 2, 4], [2, 4, 2, 2], [3, 3, 3, 1], [1, 2, 3, 2],
    [3, 1, 3, 3] // Último movimento para o centro
];

// --- Variáveis de Estado do Jogo ---
let boardState = []; // Array 2D: 0=vazio, 1=peça, -1=inválido
let selectedPeg = null; // Objeto { row: r, col: c } ou null
let currentMoveHistory = []; // Array de objetos { from: [r,c], mid: [r,c], to: [r,c] } da partida atual
let pastGames = []; // Array de objetos { timestamp, moves, finalPegs } das últimas partidas
const MAX_PAST_GAMES = 5; // Número máximo de partidas a serem salvas no histórico

// Estado das Dicas
let isHintMode = false; // Modo de jogo com dicas ativo?
let currentHintIndex = 0; // Índice da próxima dica na sequência `correctSolutionSteps`
let playerDeviated = false; // Jogador saiu da sequência de dicas?
let gameStarted = false; // O jogo foi iniciado (com ou sem dicas)?

// --- Funções Essenciais do Jogo ---

/**
 * Inicializa ou reinicia o jogo.
 * @param {boolean} startWithHints - Define se o jogo deve começar no modo com dicas.
 */
function initGame(startWithHints = false) {
    console.log(`Iniciando jogo... Modo Dicas: ${startWithHints}`);

    // 1. Salva a partida anterior (se aplicável) ANTES de resetar
    saveCurrentGameToHistory();

    // 2. Reseta o estado do jogo
    boardState = [];
    selectedPeg = null;
    currentMoveHistory = [];
    moveHistoryList.innerHTML = ''; // Limpa histórico visual da partida atual
    isHintMode = startWithHints;
    currentHintIndex = 0;
    playerDeviated = false;
    gameStarted = false; // Será definido como true após a criação do tabuleiro

    // 3. Cria o tabuleiro lógico e visual
    boardElement.innerHTML = ''; // Limpa o tabuleiro HTML anterior
    for (let r = 0; r < BOARD_SIZE; r++) {
        boardState[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            const isInvalid = INVALID_CELLS.some(cell => cell[0] === r && cell[1] === c);
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = r;
            cellElement.dataset.col = c;

            if (isInvalid) {
                boardState[r][c] = -1; // Marca como inválido no estado lógico
                cellElement.classList.add('invalid');
            } else {
                // Define o estado inicial: peça em tudo, exceto no centro
                if (r === CENTER_CELL.row && c === CENTER_CELL.col) {
                    boardState[r][c] = 0; // Vazio
                    cellElement.classList.add('empty');
                } else {
                    boardState[r][c] = 1; // Peça
                    cellElement.classList.add('peg');
                }

                // Adiciona label de coordenada visualmente
                const label = document.createElement('span');
                label.classList.add('coordinate-label');
                label.textContent = `${r},${c}`;
                cellElement.appendChild(label);
                updateCellLabelVisibility(cellElement); // Ajusta cor inicial do label

                // Adiciona listener de clique apenas para células válidas
                cellElement.addEventListener('click', handleCellClick);
            }
            boardElement.appendChild(cellElement);
        }
    }

    // 4. Lógica pós-inicialização
    gameStarted = true; // Marca que o jogo começou/está ativo
    clearHighlights(); // Garante que não há destaques remanescentes
    resetButton.disabled = false; // Habilita o botão Reiniciar

    // Remove a mensagem inicial "Nenhum movimento ainda" se existir
    document.getElementById('no-moves-yet')?.remove();
    if (moveHistoryList.children.length === 0) {
         // Se ainda estiver vazio (caso a remoção falhe ou não exista), adiciona um placeholder
         const placeholder = document.createElement('li');
         placeholder.id = 'no-moves-yet';
         placeholder.textContent = 'Faça o primeiro movimento.';
         placeholder.style.color = 'var(--border-color)';
         placeholder.style.fontStyle = 'italic';
         placeholder.style.textAlign = 'center';
         moveHistoryList.appendChild(placeholder);
    }


    if (isHintMode) {
        showNextHint(); // Mostra a primeira dica (e define a mensagem de status apropriada)
    } else {
        updateStatusMessage("Selecione uma peça para mover."); // Mensagem padrão para modo sem dicas
    }

    console.log("Tabuleiro inicializado.");
}

/**
 * Lida com o clique em uma célula do tabuleiro.
 * @param {Event} event - O evento de clique.
 */
function handleCellClick(event) {
    if (!gameStarted) {
        updateStatusMessage("O jogo não foi iniciado. Clique em 'Jogar Sem Dicas' ou 'Jogar Com Dicas'.", "warning");
        pulseElement(startNoHintsButton);
        pulseElement(startWithHintsButton);
        return;
    }

    const targetCell = event.currentTarget;
    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);

    clearErrorPulses(); // Limpa pulsos de erro anteriores

    // --- Lógica de Seleção / Movimento ---

    // Caso 1: Nenhuma peça selecionada -> Tenta selecionar uma PEÇA
    if (!selectedPeg) {
        if (boardState[row][col] === 1) { // É uma peça?
            selectPeg(row, col);
            updateStatusMessage(`Peça (${row},${col}) selecionada. Escolha um destino vazio.`);
        } else if (boardState[row][col] === 0) { // Clicou em célula vazia
             updateStatusMessage("Clique em uma PEÇA para selecioná-la primeiro.", "error");
             pulseElement(targetCell, 'error-pulse');
        } else {
            // Clicou em célula inválida (não deve acontecer devido ao pointer-events: none)
             updateStatusMessage("Célula inválida.", "error");
        }
        return;
    }

    // Caso 2: Uma peça JÁ está selecionada
    const fromRow = selectedPeg.row;
    const fromCol = selectedPeg.col;

    // Subcaso 2a: Clicou na MESMA peça selecionada -> Desseleciona
    if (row === fromRow && col === fromCol) {
        deselectPeg();
        updateStatusMessage("Seleção cancelada. Escolha uma peça.");
        return;
    }

    // Subcaso 2b: Clicou em OUTRA peça -> Muda a seleção
    if (boardState[row][col] === 1) {
        deselectPeg(); // Limpa seleção/destaques antigos
        selectPeg(row, col);
        updateStatusMessage(`Nova peça (${row},${col}) selecionada. Escolha um destino vazio.`);
        return;
    }

    // Subcaso 2c: Clicou em uma célula VAZIA -> Tenta mover
    if (boardState[row][col] === 0) {
        const move = isValidMove(fromRow, fromCol, row, col);

        if (move) { // O movimento é válido pelas regras?
            let moveIsCorrectHint = false;
            // --- Verifica se está seguindo a dica (se aplicável) ---
            if (isHintMode && !playerDeviated) {
                const expectedMove = correctSolutionSteps[currentHintIndex];
                moveIsCorrectHint =
                    expectedMove[0] === fromRow &&
                    expectedMove[1] === fromCol &&
                    expectedMove[2] === row &&
                    expectedMove[3] === col;

                if (!moveIsCorrectHint) {
                    playerDeviated = true;
                    clearHighlights(); // Remove destaques de dica, pois não são mais relevantes
                    updateStatusMessage("Você saiu da sequência de dicas! Dicas desativadas.", "warning");
                    // O jogo continua normalmente, mas sem mais dicas
                } else {
                    // Jogador seguiu a dica corretamente, avança para a próxima
                    currentHintIndex++;
                }
            }
            // --- Fim da Verificação de Dica ---

            // Executa o movimento (sempre se for válido pelas regras)
            executeMove(fromRow, fromCol, move.midRow, move.midCol, row, col);
            deselectPeg(); // Limpa seleção e destaques de movimento

            // Verifica o estado do jogo (vitória/derrota/continua)
            const gameState = checkGameState();

            // Atualiza a mensagem de status ou mostra a próxima dica
            if (gameState === "continue") {
                 if (isHintMode && !playerDeviated && currentHintIndex < correctSolutionSteps.length) {
                    showNextHint(); // Mostra a próxima dica
                 } else if (isHintMode && !playerDeviated && currentHintIndex >= correctSolutionSteps.length) {
                     updateStatusMessage("Sequência de dicas concluída! Continue jogando.", "info");
                 }
                 else {
                     // Mensagem padrão se não estiver no modo dica ou se tiver desviado
                     updateStatusMessage("Movimento realizado. Selecione a próxima peça.");
                 }
            }
            // Se gameState for "win" ou "lose", checkGameState já terá atualizado a mensagem

        } else { // Movimento inválido
            updateStatusMessage(`Movimento inválido de (${fromRow},${fromCol}) para (${row},${col}). Tente novamente.`, "error");
            pulseElement(targetCell, 'error-pulse'); // Pisca destino inválido
        }
        return;
    }
}

/**
 * Seleciona uma peça, atualiza o estado e destaca movimentos válidos.
 * @param {number} row - Linha da peça selecionada.
 * @param {number} col - Coluna da peça selecionada.
 */
function selectPeg(row, col) {
    deselectPeg(); // Garante que apenas uma peça esteja selecionada
    selectedPeg = { row, col };
    const cell = getCellElement(row, col);
    if (cell) {
        cell.classList.add('selected');
        highlightValidMoves(row, col); // Mostra possíveis destinos
    }
}

/**
 * Desseleciona a peça atual, remove destaques.
 */
function deselectPeg() {
    if (selectedPeg) {
        const cell = getCellElement(selectedPeg.row, selectedPeg.col);
        if (cell) {
            cell.classList.remove('selected');
        }
    }
    selectedPeg = null;
    clearHighlights(); // Remove destaques de movimento E de dica ao deselecionar
}

/**
 * Verifica se um movimento de uma peça para uma célula vazia é válido.
 * @param {number} fromRow - Linha da peça de origem.
 * @param {number} fromCol - Coluna da peça de origem.
 * @param {number} toRow - Linha da célula de destino.
 * @param {number} toCol - Coluna da célula de destino.
 * @returns {object | null} - Retorna { midRow, midCol } da peça pulada se o movimento for válido, senão null.
 */
function isValidMove(fromRow, fromCol, toRow, toCol) {
    // 1. Origem deve ser uma peça (verificado implicitamente ao selecionar)
    // 2. Destino deve ser vazio (verificado antes de chamar esta função)
    // 3. Destino deve estar dentro dos limites (verificado antes de chamar esta função)

    const dRow = Math.abs(fromRow - toRow);
    const dCol = Math.abs(fromCol - toCol);

    // 4. Movimento deve ser exatamente 2 casas na horizontal OU vertical
    if (!((dRow === 2 && dCol === 0) || (dRow === 0 && dCol === 2))) {
        return null;
    }

    // 5. Calcula a posição da peça intermediária (pulada)
    const midRow = fromRow + (toRow - fromRow) / 2;
    const midCol = fromCol + (toCol - fromCol) / 2;

    // 6. Verifica se a célula intermediária está dentro dos limites
    if (midRow < 0 || midRow >= BOARD_SIZE || midCol < 0 || midCol >= BOARD_SIZE) {
        return null; // Embora improvável com a lógica atual, é uma boa verificação
    }

    // 7. Verifica se HÁ uma peça na posição intermediária para ser pulada
    if (boardState[midRow]?.[midCol] !== 1) { // Usar optional chaining por segurança
        return null;
    }

    // Se passou por todas as verificações, o movimento é válido
    return { midRow, midCol };
}

/**
 * Executa o movimento no tabuleiro lógico e visual.
 * @param {number} fromRow - Linha de origem.
 * @param {number} fromCol - Coluna de origem.
 * @param {number} midRow - Linha da peça pulada.
 * @param {number} midCol - Coluna da peça pulada.
 * @param {number} toRow - Linha de destino.
 * @param {number} toCol - Coluna de destino.
 */
function executeMove(fromRow, fromCol, midRow, midCol, toRow, toCol) {
    // 1. Atualiza estado lógico
    boardState[fromRow][fromCol] = 0; // Origem fica vazia
    boardState[midRow][midCol] = 0;   // Peça pulada é removida
    boardState[toRow][toCol] = 1;     // Destino recebe a peça

    // 2. Atualiza estado visual (DOM)
    const fromCell = getCellElement(fromRow, fromCol);
    const midCell = getCellElement(midRow, midCol);
    const toCell = getCellElement(toRow, toCol);

    if (fromCell) {
        fromCell.classList.remove('peg');
        fromCell.classList.add('empty');
        updateCellLabelVisibility(fromCell); // Atualiza contraste do label
    }
    if (midCell) {
        midCell.classList.remove('peg');
        midCell.classList.add('empty');
        updateCellLabelVisibility(midCell); // Atualiza contraste do label
    }
    if (toCell) {
        toCell.classList.remove('empty');
        toCell.classList.add('peg');
        updateCellLabelVisibility(toCell); // Atualiza contraste do label
        pulseElement(toCell, 'success-pulse'); // Adiciona pulso verde ao destino
    }

    // 3. Adiciona ao histórico da partida atual
    const moveData = {
        from: [fromRow, fromCol],
        mid: [midRow, midCol],
        to: [toRow, toCol]
    };
    currentMoveHistory.push(moveData);
    addMoveToHistoryList(moveData, currentMoveHistory.length); // Atualiza lista visual
}

/**
 * Destaca as células vazias que são destinos válidos para a peça selecionada.
 * @param {number} row - Linha da peça selecionada.
 * @param {number} col - Coluna da peça selecionada.
 */
function highlightValidMoves(row, col) {
    clearHighlights(); // Limpa destaques anteriores (de movimento ou dica)
    const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]]; // Movimentos possíveis (2 casas)

    directions.forEach(dir => {
        const toRow = row + dir[0];
        const toCol = col + dir[1];

        // Verifica se o destino está dentro do tabuleiro
        if (toRow >= 0 && toRow < BOARD_SIZE && toCol >= 0 && toCol < BOARD_SIZE) {
            // Verifica se é uma célula vazia (estado lógico)
             if(boardState[toRow][toCol] === 0) {
                 // Verifica se o movimento é válido pelas regras (considera peça intermediária)
                 const move = isValidMove(row, col, toRow, toCol);
                 if (move) {
                     const targetCell = getCellElement(toRow, toCol);
                     if (targetCell) {
                         targetCell.classList.add('highlight'); // Destaca destino válido
                     }
                 }
             }
        }
    });
}

/**
 * Remove todas as classes de destaque de movimento e dica das células.
 */
function clearHighlights() {
    document.querySelectorAll('.cell.highlight, .cell.hint-target, .cell.hint-source').forEach(cell => {
        cell.classList.remove('highlight', 'hint-target', 'hint-source');
    });
}

/**
 * Remove classes de pulso de erro das células.
 */
function clearErrorPulses() {
    document.querySelectorAll('.cell.error-pulse').forEach(cell => {
        cell.classList.remove('error-pulse');
    });
}

/**
 * Adiciona um item de movimento à lista visual de histórico da partida atual.
 * @param {object} moveData - Objeto com informações do movimento {from, mid, to}.
 * @param {number} moveNumber - O número sequencial do movimento.
 */
function addMoveToHistoryList(moveData, moveNumber) {
    // Remove o placeholder "Faça o primeiro movimento" se for o primeiro movimento
    if (moveNumber === 1) {
        document.getElementById('no-moves-yet')?.remove();
    }

    const listItem = document.createElement('li');
    const remainingPegs = countPegs(); // Calcula peças restantes *após* o movimento
    listItem.innerHTML = `
        ${moveNumber}. <span class="move-coords">(${moveData.from.join(',')}) &rarr; (${moveData.to.join(',')})</span>
        <span class="peg-count" title="Peças restantes">${remainingPegs}</span>
    `;
    moveHistoryList.appendChild(listItem);
    // Auto-scroll para mostrar o último movimento adicionado
    moveHistoryList.scrollTop = moveHistoryList.scrollHeight;
}

/**
 * Conta o número de peças restantes no tabuleiro.
 * @returns {number} - O número de peças (valor 1 no boardState).
 */
function countPegs() {
    let count = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (boardState[r]?.[c] === 1) { // Verifica se é uma peça
                count++;
            }
        }
    }
    return count;
}

/**
 * Verifica o estado atual do jogo (vitória, derrota ou continua).
 * Atualiza a mensagem de status e desabilita interações se o jogo acabou.
 * @returns {"win" | "lose" | "continue"} - O estado do jogo.
 */
function checkGameState() {
    const remainingPegs = countPegs();
    let possibleMoves = 0;

    // Verifica se ainda existem movimentos possíveis
    if (remainingPegs > 1) { // Só precisa verificar se há mais de 1 peça
        for (let r = 0; r < BOARD_SIZE && possibleMoves === 0; r++) {
            for (let c = 0; c < BOARD_SIZE && possibleMoves === 0; c++) {
                if (boardState[r][c] === 1) { // Se for uma peça
                    const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];
                    for (const dir of directions) {
                        const toRow = r + dir[0];
                        const toCol = c + dir[1];
                        // Verifica se o destino está dentro dos limites
                        if (toRow >= 0 && toRow < BOARD_SIZE && toCol >= 0 && toCol < BOARD_SIZE) {
                            // Verifica se é um movimento válido (considera peça intermediária e destino vazio)
                             if (boardState[toRow][toCol] === 0 && isValidMove(r, c, toRow, toCol)) {
                                possibleMoves++;
                                break; // Basta um movimento possível para esta peça
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Determina o Estado ---

    // Condição de Vitória: Exatamente 1 peça restante E está no centro
    if (remainingPegs === 1 && boardState[CENTER_CELL.row][CENTER_CELL.col] === 1) {
        updateStatusMessage("Parabéns! Você venceu!", "success");
        disableBoardInteraction();
        saveCurrentGameToHistory(); // Salva o jogo vitorioso
        gameStarted = false;
        return "win";
    }

    // Condição de Derrota: Nenhuma peça selecionada (implícito após movimento) E não há mais movimentos possíveis
    if (possibleMoves === 0) {
         if (remainingPegs === 1) { // 1 peça fora do centro
             updateStatusMessage(`Fim de jogo! Restou 1 peça fora do centro.`, "final");
         } else { // Mais de 1 peça, sem movimentos
             updateStatusMessage(`Fim de jogo! Não há mais movimentos. Restaram ${remainingPegs} peças.`, "final");
         }
        disableBoardInteraction();
        saveCurrentGameToHistory(); // Salva o jogo finalizado
        gameStarted = false;
        return "lose";
    }

    // Jogo Continua: Se nenhuma das condições acima for atendida
    return "continue";
}

/**
 * Desabilita cliques no tabuleiro e limpa destaques/seleção (fim de jogo).
 */
function disableBoardInteraction() {
    console.log("Desabilitando interação com o tabuleiro.");
    document.querySelectorAll('.cell:not(.invalid)').forEach(cell => {
        // Remove o listener específico para evitar remover outros possíveis listeners
        cell.removeEventListener('click', handleCellClick);
        cell.style.cursor = 'default'; // Muda o cursor para indicar inatividade
    });
    deselectPeg(); // Garante que nenhuma peça fique selecionada ou destacada
}

/**
 * Atualiza a mensagem de status exibida para o usuário.
 * @param {string} message - A mensagem a ser exibida.
 * @param {"info" | "success" | "error" | "warning" | "final"} type - O tipo de mensagem para estilização.
 */
function updateStatusMessage(message = "", type = "info") {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message'; // Reseta classes de cor anteriores
    let colorVar = '--accent-yellow'; // Cor padrão (info)

    switch (type) {
        case 'error':
            colorVar = '--error-red';
            break;
        case 'success':
            colorVar = '--accent-green';
            break;
        case 'warning':
            colorVar = '--accent-yellow';
            break;
        case 'final': // Fim de jogo (derrota ou vitória com peça fora do centro)
            colorVar = '--accent-cyan';
            break;
        case 'info':
        default:
            colorVar = '--accent-yellow';
            break;
    }
    statusMessage.style.color = `var(${colorVar})`;
}

/**
 * Obtém o elemento DOM da célula com base na linha e coluna.
 * @param {number} row - Linha da célula.
 * @param {number} col - Coluna da célula.
 * @returns {HTMLElement | null} - O elemento da célula ou null se não encontrado.
 */
function getCellElement(row, col) {
    return boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

/**
 * Adiciona um efeito de pulso CSS a um elemento.
 * @param {HTMLElement} element - O elemento a ser pulsado.
 * @param {string} pulseClass - A classe CSS que define a animação de pulso.
 */
function pulseElement(element, pulseClass = 'error-pulse') {
    if (!element) return;
    element.classList.add(pulseClass);
    // Remove a classe após a animação para permitir repetição em cliques futuros
    element.addEventListener('animationend', () => {
        element.classList.remove(pulseClass);
    }, { once: true }); // Listener é removido automaticamente após disparar uma vez
}

/**
 * Ajusta a cor do label de coordenada para garantir contraste com o fundo da célula (peça ou vazio).
 * @param {HTMLElement} cellElement - O elemento da célula.
 */
function updateCellLabelVisibility(cellElement) {
    const label = cellElement.querySelector('.coordinate-label');
    if (!label) return;

    if (cellElement.classList.contains('peg')) {
        // Fundo claro (peça ciano/verde/rosa), label escuro
        label.style.color = 'var(--bg-secondary-opaque)';
    } else if (cellElement.classList.contains('empty')) {
        // Fundo escuro (célula vazia), label claro
        label.style.color = 'var(--border-color)';
    }
    // Não mexe na opacidade, apenas na cor para contraste
}


// --- Lógica das Dicas ---

/**
 * Mostra a próxima dica na sequência, se aplicável.
 */
function showNextHint() {
    // Não mostra dica se não estiver no modo, se o jogador desviou, ou se acabaram as dicas
    if (!isHintMode || playerDeviated || currentHintIndex >= correctSolutionSteps.length) {
        clearHighlights(); // Garante que não há destaques de dica
        if (isHintMode && !playerDeviated && currentHintIndex >= correctSolutionSteps.length) {
             // Apenas atualiza a mensagem se as dicas acabaram mas o jogo não
             if(checkGameState() === 'continue') {
                updateStatusMessage("Sequência de dicas concluída! Continue jogando.", "info");
             }
        }
        return;
    }

    const [fromRow, fromCol, toRow, toCol] = correctSolutionSteps[currentHintIndex];

    // Verifica se a dica ainda é válida no estado atual do tabuleiro (segurança)
    if (boardState[fromRow]?.[fromCol] === 1 && boardState[toRow]?.[toCol] === 0) {
        highlightHint(fromRow, fromCol, toRow, toCol);
        updateStatusMessage(`Dica ${currentHintIndex + 1}/${correctSolutionSteps.length}: Mova (${fromRow},${fromCol}) para (${toRow},${toCol}).`, "info");
    } else {
        // Estado inesperado: a dica não corresponde ao tabuleiro. Isso não deveria acontecer
        // se a lógica do jogo e a sequência de dicas estiverem corretas.
        console.error(`Erro na Dica ${currentHintIndex}: Estado do tabuleiro inconsistente. Peça em (${fromRow},${fromCol})=${boardState[fromRow]?.[fromCol]}, Destino em (${toRow},${toCol})=${boardState[toRow]?.[toCol]}`);
        updateStatusMessage("Erro interno na sequência de dicas. Dicas desativadas.", "error");
        isHintMode = false; // Desativa modo dica para evitar mais erros
        playerDeviated = true; // Marca como desviado
        clearHighlights();
    }
}

/**
 * Destaca visualmente a peça de origem e o destino da dica atual.
 * @param {number} fromRow - Linha da peça de origem da dica.
 * @param {number} fromCol - Coluna da peça de origem da dica.
 * @param {number} toRow - Linha da célula de destino da dica.
 * @param {number} toCol - Coluna da célula de destino da dica.
 */
function highlightHint(fromRow, fromCol, toRow, toCol) {
    clearHighlights(); // Limpa destaques anteriores (de movimento ou dica)

    const sourceCell = getCellElement(fromRow, fromCol);
    const targetCell = getCellElement(toRow, toCol);

    if (sourceCell) sourceCell.classList.add('hint-source'); // Aplica estilo de origem
    if (targetCell) targetCell.classList.add('hint-target'); // Aplica estilo de destino
}


// --- Lógica do Histórico de Partidas (localStorage e Modal) ---

/**
 * Carrega o histórico das últimas partidas salvas no localStorage.
 */
function loadPastGames() {
    try {
        const storedGames = localStorage.getItem('resta1PastGames');
        pastGames = storedGames ? JSON.parse(storedGames) : [];
        console.log(`Histórico de ${pastGames.length} partida(s) carregado.`);
    } catch (error) {
        console.error("Erro ao carregar histórico do localStorage:", error);
        pastGames = []; // Reseta em caso de erro de parsing
    }
}

/**
 * Salva o array `pastGames` atual no localStorage.
 */
function savePastGames() {
    try {
        localStorage.setItem('resta1PastGames', JSON.stringify(pastGames));
        console.log(`Histórico de ${pastGames.length} partida(s) salvo.`);
    } catch (error) {
        console.error("Erro ao salvar histórico no localStorage:", error);
        // Considerar notificar o usuário se o localStorage estiver cheio ou indisponível
    }
}

/**
 * Salva a partida ATUAL (se teve movimentos) para o histórico `pastGames`.
 * Chamado no início de `initGame` (para salvar a partida anterior) e no fim do jogo.
 */
function saveCurrentGameToHistory() {
    // Só salva se o jogo tinha sido iniciado E teve pelo menos um movimento
    if (gameStarted && currentMoveHistory.length > 0) {
        console.log(`Salvando partida atual com ${currentMoveHistory.length} movimentos.`);
        // Cria um objeto para a partida concluída/interrompida
        const gameData = {
            timestamp: new Date().toLocaleString('pt-BR'), // Data/hora local
            moves: [...currentMoveHistory], // Cria uma cópia profunda do array de movimentos
            finalPegs: countPegs() // Salva quantas peças restaram no momento do salvamento
        };

        // Adiciona a partida atual ao início do array (mais recentes primeiro)
        pastGames.unshift(gameData);

        // Mantém apenas as últimas MAX_PAST_GAMES partidas
        if (pastGames.length > MAX_PAST_GAMES) {
            pastGames.pop(); // Remove a mais antiga (do final do array)
        }
        savePastGames(); // Persiste as alterações no localStorage
    }
    // Importante: Reseta o histórico da partida atual para a próxima, mesmo que não tenha salvo
    currentMoveHistory = [];
}

/**
 * Mostra o modal com a lista de partidas salvas.
 */
function showPastGamesModal() {
    loadPastGames(); // Carrega os dados mais recentes do localStorage

    pastGamesList.innerHTML = ''; // Limpa a lista visual anterior
    selectedGameDetails.style.display = 'none'; // Esconde a área de detalhes
    selectedGameMovesTextArea.value = ''; // Limpa a textarea
    copySequenceButton.disabled = true; // Desabilita botão de cópia inicialmente
    copySequenceButton.textContent = 'Copiar Sequência'; // Reseta texto do botão

    if (pastGames.length === 0) {
        pastGamesList.innerHTML = '<li style="text-align: center; color: var(--border-color); font-style: italic;">Nenhuma partida salva ainda.</li>';
    } else {
        pastGames.forEach((game, index) => {
            const listItem = document.createElement('li');
            // Formata a exibição de cada partida na lista
            listItem.textContent = `Partida ${pastGames.length - index} (${game.timestamp}) - ${game.moves.length} mov. - ${game.finalPegs} peças`;
            listItem.dataset.gameIndex = index; // Guarda o índice ORIGINAL no array `pastGames`
            listItem.addEventListener('click', handlePastGameSelection);
            pastGamesList.appendChild(listItem);
        });
    }

    // Ativa a exibição do modal e do overlay
    modalOverlay.classList.add('active');
    pastGamesModal.classList.add('active');
}

/**
 * Esconde o modal de histórico de partidas.
 */
function hidePastGamesModal() {
    modalOverlay.classList.remove('active');
    pastGamesModal.classList.remove('active');
    // Remove destaque de seleção da lista ao fechar
    const selectedItem = pastGamesList.querySelector('.selected');
    if (selectedItem) {
        selectedItem.classList.remove('selected');
    }
}

/**
 * Lida com a seleção de uma partida na lista do modal.
 * @param {Event} event - O evento de clique no item da lista.
 */
function handlePastGameSelection(event) {
    const selectedItem = event.currentTarget;
    const gameIndex = parseInt(selectedItem.dataset.gameIndex);

    // Remove destaque de outros itens e adiciona ao clicado
    pastGamesList.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
    selectedItem.classList.add('selected');

    // Exibe os detalhes do jogo selecionado
    displaySelectedGame(gameIndex);
}

/**
 * Exibe os movimentos da partida selecionada na textarea do modal.
 * @param {number} index - O índice da partida no array `pastGames`.
 */
function displaySelectedGame(index) {
    if (index < 0 || index >= pastGames.length) return; // Índice inválido

    const game = pastGames[index];
    // Formata a string da sequência de movimentos
    let sequenceString = `Partida de ${game.timestamp}\n`;
    sequenceString += `(${game.moves.length} movimentos, ${game.finalPegs} peças restantes)\n`;
    sequenceString += "----------------------------------\n";
    sequenceString += game.moves.map((move, i) =>
        `${String(i + 1).padStart(2, ' ')}. (${move.from.join(',')}) -> (${move.to.join(',')})` // Formato: Num. (Linha,Col) -> (Linha,Col)
    ).join('\n'); // Separa cada movimento por uma nova linha

    selectedGameMovesTextArea.value = sequenceString;
    selectedGameDetails.style.display = 'block'; // Mostra a área de detalhes
    copySequenceButton.disabled = false; // Habilita o botão de cópia
    copySequenceButton.textContent = 'Copiar Sequência'; // Reseta texto do botão
}

/**
 * Copia a sequência de movimentos exibida na textarea para a área de transferência.
 */
function copySelectedGameSequence() {
    const sequence = selectedGameMovesTextArea.value;
    if (!sequence) {
        console.warn("Tentativa de copiar sequência vazia.");
        return;
    }
    // Verifica se a API Clipboard está disponível (navegadores modernos, contexto seguro)
    if (!navigator.clipboard) {
        updateStatusMessage("Erro: Cópia não suportada pelo navegador ou contexto inseguro.", "error");
        console.error("API navigator.clipboard não disponível.");
        copySequenceButton.textContent = 'Cópia Falhou';
        copySequenceButton.disabled = true;
        return;
    }

    navigator.clipboard.writeText(sequence).then(() => {
        console.log("Sequência copiada para a área de transferência.");
        copySequenceButton.textContent = 'Copiado!';
        copySequenceButton.disabled = true; // Desabilita temporariamente após sucesso
        // Reabilita o botão após um curto período
        setTimeout(() => {
            // Verifica se o modal ainda está exibindo detalhes antes de reabilitar
             if (selectedGameDetails.style.display === 'block' && pastGamesModal.classList.contains('active')) {
                copySequenceButton.textContent = 'Copiar Sequência';
                copySequenceButton.disabled = false;
             }
        }, 2500); // Volta ao normal após 2.5 segundos
    }).catch(err => {
        console.error('Erro ao copiar sequência:', err);
        updateStatusMessage("Falha ao copiar a sequência.", "error");
        copySequenceButton.textContent = 'Falha ao Copiar';
        // Pode ser útil reabilitar o botão mesmo em caso de falha, para nova tentativa
        copySequenceButton.disabled = false;
    });
}


// --- Lógica do Ano no Footer ---

/**
 * Atualiza o ano atual no elemento span#current-year do footer.
 */
function updateFooterYear() {
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}


// --- Event Listeners ---

// Botões de controle do jogo
resetButton.addEventListener('click', () => {
    console.log("Botão Reiniciar clicado.");
    initGame(false); // Reinicia sempre sem dicas
});

startNoHintsButton.addEventListener('click', () => {
    console.log("Botão Jogar Sem Dicas clicado.");
    initGame(false); // Inicia/Reinicia sem dicas
});

startWithHintsButton.addEventListener('click', () => {
    console.log("Botão Jogar Com Dicas clicado.");
    initGame(true); // Inicia/Reinicia com dicas
});

// Botão para abrir o modal de histórico
viewHistoryButton.addEventListener('click', () => {
    console.log("Botão Últimas Partidas clicado.");
    showPastGamesModal();
});

// Controles do Modal
closeModalButton.addEventListener('click', () => {
    console.log("Botão Fechar Modal clicado.");
    hidePastGamesModal();
});

modalOverlay.addEventListener('click', () => {
    console.log("Clique no Overlay do Modal.");
    hidePastGamesModal(); // Fecha o modal ao clicar fora dele
});

copySequenceButton.addEventListener('click', () => {
    console.log("Botão Copiar Sequência clicado.");
    copySelectedGameSequence();
});

// Listener para atualizar o ano no footer quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', updateFooterYear);


// --- Inicialização do Jogo ---
console.log("Iniciando script do jogo Resta 1...");
loadPastGames(); // Carrega o histórico de partidas salvas do localStorage primeiro
initGame(false); // Inicia o jogo automaticamente no modo "Sem Dicas" ao carregar a página
console.log("Jogo inicializado no modo padrão (Sem Dicas).");