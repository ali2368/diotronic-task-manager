import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, arrayUnion, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

const firebaseConfig = {
    apiKey: "AIzaSyCfAlj51JPt5Uz8e7aymCaD8bi8JORLF2c",
    authDomain: "bitacoradiotronic.firebaseapp.com",
    projectId: "bitacoradiotronic",
    storageBucket: "bitacoradiotronic.firebasestorage.app",
    messagingSenderId: "249063253816",
    appId: "1:249063253816:web:06c4d1802c3d47b9ab83cd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let tasks = [];
let activeTasks = {};
let timerInterval = null;
let currentUser = null;
let statusChart = null;
let trendChart = null;
let currentSearchTerm = '';

// Inicializar autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const userName = user.email.split('@')[0];
        document.getElementById('userName').textContent = userName;
        
        // También actualizar nombre móvil
        const userNameMobile = document.getElementById('userNameMobile');
        if (userNameMobile) {
            userNameMobile.textContent = userName;
        }
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        initApp();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContainer').classList.remove('active');
    }
});

// Cargar tema guardado
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);
updateLogos(savedTheme);

// LOGIN
window.handleLogin = async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    btn.textContent = 'Iniciando...';
    btn.disabled = true;
    errorDiv.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorDiv.textContent = 'Credenciales incorrectas. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');
        btn.textContent = 'Iniciar Sesión';
        btn.disabled = false;
    }
}

window.handleLogout = async function() {
    if (!confirm('¿Cerrar sesión?')) return;
    
    await signOut(auth);
    clearInterval(timerInterval);
    activeTasks = {};
    tasks = [];
    localStorage.removeItem('activeTasks');
}

function initApp() {
    document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
    loadTasks();
    checkActiveTask();
    generateMonthButtons();
    renderCalendar();
    
    // Aplicar filtro de mes actual por defecto al cargar
    setTimeout(() => {
        filterCurrentMonth();
    }, 500);
}

function checkActiveTask() {
    const saved = localStorage.getItem('activeTasks');
    if (saved) {
        activeTasks = JSON.parse(saved);
        startTimer();
        displayTasks();
    }
}

// ==================== TABS ====================
window.switchTab = function(tabName) {
    // Remover active de todos los tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activar tab seleccionado
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Si es calendario, renderizarlo
    if (tabName === 'calendar') {
        renderCalendar();
    }
    
    // Si es dashboard, actualizar gráficos
    if (tabName === 'dashboard') {
        updateCharts();
    }
}

// ==================== INICIO RÁPIDO ====================
window.startNewTask = function() {
    const user = document.getElementById('quickUser').value.trim();
    const desc = document.getElementById('quickDesc').value.trim();
    const tags = document.getElementById('quickTags').value.trim();
    const assignee = document.getElementById('quickAssignee').value;

    if (!user) {
        showToast('Por favor ingresa el usuario/servicio', 'error');
        return;
    }

    const now = new Date();
    const taskId = 'task_' + now.getTime();
    
    activeTasks[taskId] = {
        id: taskId,
        supportName: assignee,
        date: now.toISOString().split('T')[0],
        user,
        startTime: now.toTimeString().split(' ')[0].substring(0, 5),
        startTimestamp: now.getTime(),
        description: desc || 'En progreso...',
        status: 'En Progreso',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        pausedTime: 0,
        isPaused: false,
        comments: [],
        history: [{
            action: 'Creada',
            date: now.toISOString(),
            user: currentUser.email,
            details: 'Tarea iniciada'
        }]
    };

    localStorage.setItem('activeTasks', JSON.stringify(activeTasks));
    
    document.getElementById('quickUser').value = '';
    document.getElementById('quickDesc').value = '';
    document.getElementById('quickTags').value = '';
    
    startTimer();
    displayTasks();
    updateStats();
    showToast('⏱️ Tarea iniciada correctamente', 'success');
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        displayTasks();
    }, 1000);
}

function getCurrentTimer(task) {
    if (!task || task.isPaused) {
        const elapsed = task.pausedTime || 0;
        const h = Math.floor(elapsed / 3600000);
        const m = Math.floor((elapsed % 3600000) / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    
    const elapsed = Date.now() - task.startTimestamp + (task.pausedTime || 0);
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

window.pauseTask = function(taskId) {
    const task = activeTasks[taskId];
    if (!task) return;

    task.isPaused = !task.isPaused;
    
    if (task.isPaused) {
        task.pausedTime = Date.now() - task.startTimestamp + (task.pausedTime || 0);
        task.history.push({
            action: 'Pausada',
            date: new Date().toISOString(),
            user: currentUser.email,
            details: 'Tarea pausada temporalmente'
        });
        showToast('⏸️ Tarea pausada', 'warning');
    } else {
        task.startTimestamp = Date.now() - (task.pausedTime || 0);
        task.pausedTime = 0;
        task.history.push({
            action: 'Reanudada',
            date: new Date().toISOString(),
            user: currentUser.email,
            details: 'Tarea reanudada'
        });
        showToast('▶️ Tarea reanudada', 'success');
    }
    
    localStorage.setItem('activeTasks', JSON.stringify(activeTasks));
    displayTasks();
}

window.suspendTask = async function(taskId) {
    const task = activeTasks[taskId];
    if (!task) return;

    if (!confirm('¿Suspender temporalmente esta tarea? Podrás retomarla después desde la lista de tareas.')) return;

    const endTime = new Date();
    task.endTime = endTime.toTimeString().split(' ')[0].substring(0, 5);
    task.status = 'Suspendida Temporalmente';

    const finalDesc = prompt('📝 Nota sobre la suspensión (opcional):', task.description);
    if (finalDesc !== null && finalDesc.trim() !== '') {
        task.description = finalDesc.trim();
    }

    task.history.push({
        action: 'Suspendida',
        date: new Date().toISOString(),
        user: currentUser.email,
        details: 'Tarea suspendida temporalmente'
    });

    try {
        const elapsedTime = Date.now() - task.startTimestamp + (task.pausedTime || 0);
        
        await addDoc(collection(db, 'tasks'), {
            supportName: task.supportName,
            date: task.date,
            user: task.user,
            startTime: task.startTime,
            endTime: task.endTime,
            description: task.description,
            status: 'Suspendida Temporalmente',
            tags: task.tags || [],
            accumulatedTime: elapsedTime,
            comments: task.comments || [],
            history: task.history || [],
            createdAt: new Date().toISOString()
        });

        delete activeTasks[taskId];
        localStorage.setItem('activeTasks', JSON.stringify(activeTasks));

        if (Object.keys(activeTasks).length === 0) {
            clearInterval(timerInterval);
        }

        showToast('⏸️ Tarea suspendida. Podrás retomarla después', 'warning');
        await loadTasks();
    } catch (error) {
        showToast('Error al guardar: ' + error.message, 'error');
    }
}

window.resumeTask = async function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status !== 'Suspendida Temporalmente') return;

    if (!confirm('¿Retomar esta tarea suspendida?')) return;

    const now = new Date();
    const newTaskId = 'task_' + now.getTime();
    
    activeTasks[newTaskId] = {
        id: newTaskId,
        supportName: task.supportName,
        date: now.toISOString().split('T')[0],
        user: task.user,
        startTime: now.toTimeString().split(' ')[0].substring(0, 5),
        startTimestamp: now.getTime(),
        description: task.description,
        status: 'En Progreso',
        tags: task.tags || [],
        pausedTime: task.accumulatedTime || 0,
        isPaused: false,
        comments: task.comments || [],
        history: task.history || [],
        originalTaskId: taskId
    };

    activeTasks[newTaskId].history.push({
        action: 'Retomada',
        date: now.toISOString(),
        user: currentUser.email,
        details: 'Tarea retomada después de suspensión'
    });

    localStorage.setItem('activeTasks', JSON.stringify(activeTasks));
    
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
        console.error('Error al eliminar tarea suspendida:', error);
    }

    startTimer();
    await loadTasks();
    showToast('▶️ Tarea retomada exitosamente', 'success');
}

window.completeTask = async function(taskId) {
    const task = activeTasks[taskId];
    if (!task) return;

    const endTime = new Date();
    task.endTime = endTime.toTimeString().split(' ')[0].substring(0, 5);

    const statusChoice = prompt('¿Cómo finalizó la tarea?\n\n1 = Completada con éxito\n2 = Cerrada sin éxito\n3 = Cancelada\n\nEscribe el número:', '1');
    
    if (statusChoice === null) return;

    switch(statusChoice.trim()) {
        case '1':
            task.status = 'Completada';
            break;
        case '2':
            task.status = 'Cerrada sin éxito';
            break;
        case '3':
            task.status = 'Cancelada';
            break;
        default:
            task.status = 'Completada';
    }

    const finalDesc = prompt('📝 Descripción final de la labor realizada:', task.description);
    if (finalDesc !== null && finalDesc.trim() !== '') {
        task.description = finalDesc.trim();
    }

    task.history.push({
        action: 'Finalizada',
        date: new Date().toISOString(),
        user: currentUser.email,
        details: `Tarea marcada como: ${task.status}`
    });

    try {
        const taskData = {
            supportName: task.supportName,
            date: task.date,
            user: task.user,
            startTime: task.startTime,
            endTime: task.endTime,
            description: task.description,
            status: task.status,
            tags: task.tags || [],
            comments: task.comments || [],
            history: task.history || [],
            createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, 'tasks'), taskData);

        delete activeTasks[taskId];
        localStorage.setItem('activeTasks', JSON.stringify(activeTasks));

        if (Object.keys(activeTasks).length === 0) {
            clearInterval(timerInterval);
        }

        const statusMsg = task.status === 'Completada' ? '✅ Tarea completada' : 
                         task.status === 'Cerrada sin éxito' ? '⚠️ Tarea cerrada sin éxito' : 
                         '❌ Tarea cancelada';
        showToast(statusMsg + ' exitosamente', 'success');
        await loadTasks();
        updateCharts();
    } catch (error) {
        showToast('Error al guardar: ' + error.message, 'error');
    }
}

window.cancelActiveTask = function(taskId) {
    if (!confirm('¿Cancelar esta tarea? Los datos se perderán.')) return;

    delete activeTasks[taskId];
    localStorage.setItem('activeTasks', JSON.stringify(activeTasks));

    if (Object.keys(activeTasks).length === 0) {
        clearInterval(timerInterval);
    }

    displayTasks();
    showToast('❌ Tarea cancelada', 'error');
}

// ==================== TAREA MANUAL ====================
window.addManualTask = async function(e) {
    e.preventDefault();

    const tags = document.getElementById('manualTags').value.trim();
    const assignee = document.getElementById('manualAssignee').value;

    const task = {
        supportName: assignee,
        date: document.getElementById('manualDate').value,
        user: document.getElementById('manualUser').value,
        startTime: document.getElementById('manualStart').value,
        endTime: document.getElementById('manualEnd').value,
        description: document.getElementById('manualDesc').value,
        status: 'Completada',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        comments: [],
        history: [{
            action: 'Creada manualmente',
            date: new Date().toISOString(),
            user: currentUser.email,
            details: 'Tarea registrada manualmente'
        }],
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'tasks'), task);
        
        showToast('✅ Tarea guardada correctamente', 'success');
        document.getElementById('manualForm').reset();
        document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
        await loadTasks();
        updateCharts();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// ==================== CARGAR TAREAS ====================
async function loadTasks() {
    try {
        const q = query(collection(db, 'tasks'));
        const snapshot = await getDocs(q);

        tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });

        // ORDENAR POR FECHA Y HORA DE INICIO (más recientes primero)
        tasks.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.startTime || '').localeCompare(a.startTime || '');
        });

        displayTasks();
        updateStats();
        populateFilters();
        updateCharts();
        
        // APLICAR FILTRO DE MES ACTUAL AUTOMÁTICAMENTE
        setTimeout(() => {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            document.getElementById('monthFilter').value = currentMonth;
            filterTasks();
        }, 100);
    } catch (error) {
        showToast('Error al cargar: ' + error.message, 'error');
    }
}

// ==================== MOSTRAR TAREAS ====================
function displayTasks(filtered = null) {
    const container = document.getElementById('tasksContainer');
    const toShow = filtered || tasks;

    const tasksByMonth = {};
    
    // Agrupar tareas activas
    Object.entries(activeTasks).forEach(([taskId, task]) => {
        const monthKey = task.date.substring(0, 7);
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = { active: [], completed: [] };
        }
        tasksByMonth[monthKey].active.push({ taskId, task });
    });

    // Ordenar tareas activas por fecha y hora
    Object.keys(tasksByMonth).forEach(monthKey => {
        tasksByMonth[monthKey].active.sort((a, b) => {
            const dateCompare = b.task.date.localeCompare(a.task.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.task.startTime || '').localeCompare(a.task.startTime || '');
        });
    });

    // Agrupar tareas completadas
    toShow.forEach(task => {
        const monthKey = task.date.substring(0, 7);
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = { active: [], completed: [] };
        }
        tasksByMonth[monthKey].completed.push(task);
    });

    const sortedMonths = Object.keys(tasksByMonth).sort().reverse();

    let html = '';

    if (sortedMonths.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>No hay tareas</h3>
                <p>Inicia una nueva tarea con el botón de arriba</p>
            </div>
        `;
    } else {
        sortedMonths.forEach(monthKey => {
            const monthData = tasksByMonth[monthKey];
            const hasActiveTasks = monthData.active.length > 0;
            const hasCompletedTasks = monthData.completed.length > 0;

            if (!hasActiveTasks && !hasCompletedTasks) return;

            html += `
                <div style="background: linear-gradient(135deg, #59acc6 0%, #a2c125 100%); color: white; padding: 15px 20px; border-radius: 12px; margin: 20px 0 15px 0; font-weight: 700; font-size: 1.2em; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    📅 ${formatMonth(monthKey)}
                </div>
            `;

            html += `
                <table class="tasks-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Soportista</th>
                            <th>Usuario/Servicio</th>
                            <th>Horario</th>
                            <th>Duración</th>
                            <th>Estado</th>
                            <th>Labor</th>
                            <th>Etiquetas</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            monthData.active.forEach(({ taskId, task }) => {
                const timer = getCurrentTimer(task);
                const tagsHtml = (task.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('');
                
                html += `
                    <tr class="active-task-row">
                        <td data-label="Fecha"><strong>${formatDate(task.date)}</strong></td>
                        <td data-label="Soportista">${task.supportName}</td>
                        <td data-label="Usuario"><strong>${task.user}</strong></td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - <strong>En curso</strong></td>
                        <td data-label="Duración"><span class="timer-badge">${timer}</span></td>
                        <td data-label="Estado"><span class="status-badge status-en-progreso">⏳ En Progreso</span></td>
                        <td data-label="Labor">${task.description}</td>
                        <td data-label="Etiquetas">${tagsHtml || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-warning btn-small" onclick="pauseTask('${taskId}')">${task.isPaused ? '▶️ Reanudar' : '⏸️ Pausar'}</button>
                                <button class="btn-primary btn-small" onclick="suspendTask('${taskId}')">💾 Suspender</button>
                                <button class="btn-success btn-small" onclick="completeTask('${taskId}')">✅ Finalizar</button>
                                <button class="btn-danger btn-small" onclick="cancelActiveTask('${taskId}')">❌ Cancelar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            monthData.completed.forEach(task => {
                const duration = calcDuration(task.startTime, task.endTime);
                const statusClass = getStatusClass(task.status);
                const isSuspended = task.status === 'Suspendida Temporalmente';
                const tagsHtml = (task.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('');
                
                html += `
                    <tr>
                        <td data-label="Fecha">${formatDate(task.date)}</td>
                        <td data-label="Soportista">${task.supportName || 'Kendall David Ali Gómez'}</td>
                        <td data-label="Usuario">${task.user}</td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}</td>
                        <td data-label="Duración"><span class="duration-badge">${duration}</span></td>
                        <td data-label="Estado"><span class="status-badge ${statusClass}">${task.status}</span></td>
                        <td data-label="Labor">${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}</td>
                        <td data-label="Etiquetas">${tagsHtml || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                ${isSuspended ? `<button class="btn-primary btn-small" onclick="resumeTask('${task.id}')">▶️ Retomar</button>` : ''}
                                <button class="btn-primary btn-small" onclick="openEditModal('${task.id}')">✏️ Editar</button>
                                <button class="btn-secondary btn-small" onclick="openCommentsModal('${task.id}')">💬 Comentarios</button>
                                <button class="btn-secondary btn-small" onclick="openHistoryModal('${task.id}')">📜 Historial</button>
                                <button class="btn-danger btn-small" onclick="deleteTask('${task.id}')">🗑️ Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        });
    }

    container.innerHTML = html;
}

// ==================== EDITAR TAREA ====================
window.openEditModal = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('editTaskId').value = taskId;
    document.getElementById('editDate').value = task.date;
    document.getElementById('editUser').value = task.user;
    document.getElementById('editStart').value = task.startTime;
    document.getElementById('editEnd').value = task.endTime;
    document.getElementById('editStatus').value = task.status;
    document.getElementById('editDesc').value = task.description;
    document.getElementById('editAssignee').value = task.supportName || 'Kendall David Ali Gómez';
    document.getElementById('editTags').value = (task.tags || []).join(', ');

    document.getElementById('editModal').classList.add('active');
}

window.closeEditModal = function() {
    document.getElementById('editModal').classList.remove('active');
}

window.saveEditTask = async function(e) {
    e.preventDefault();

    const taskId = document.getElementById('editTaskId').value;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldData = { ...task };
    const tagsInput = document.getElementById('editTags').value.trim();

    const updates = {
        date: document.getElementById('editDate').value,
        user: document.getElementById('editUser').value,
        startTime: document.getElementById('editStart').value,
        endTime: document.getElementById('editEnd').value,
        status: document.getElementById('editStatus').value,
        description: document.getElementById('editDesc').value,
        supportName: document.getElementById('editAssignee').value,
        tags: tagsInput ? tagsInput.split(',').map(t => t.trim()) : []
    };

    // Crear registro de cambios
    const changes = [];
    if (oldData.date !== updates.date) changes.push(`Fecha: ${oldData.date} → ${updates.date}`);
    if (oldData.user !== updates.user) changes.push(`Usuario: ${oldData.user} → ${updates.user}`);
    if (oldData.startTime !== updates.startTime) changes.push(`Hora inicio: ${oldData.startTime} → ${updates.startTime}`);
    if (oldData.endTime !== updates.endTime) changes.push(`Hora fin: ${oldData.endTime} → ${updates.endTime}`);
    if (oldData.status !== updates.status) changes.push(`Estado: ${oldData.status} → ${updates.status}`);
    if (oldData.description !== updates.description) changes.push(`Descripción actualizada`);

    const historyEntry = {
        action: 'Editada',
        date: new Date().toISOString(),
        user: currentUser.email,
        details: changes.join(', ') || 'Sin cambios'
    };

    updates.history = [...(task.history || []), historyEntry];

    try {
        await updateDoc(doc(db, 'tasks', taskId), updates);
        
        showToast('✅ Tarea actualizada correctamente', 'success');
        closeEditModal();
        await loadTasks();
    } catch (error) {
        showToast('Error al actualizar: ' + error.message, 'error');
    }
}

// ==================== COMENTARIOS ====================
window.openCommentsModal = async function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('commentTaskId').value = taskId;
    
    const commentsList = document.getElementById('commentsList');
    const comments = task.comments || [];
    
    if (comments.length === 0) {
        commentsList.innerHTML = '<div class="empty-state"><p>No hay comentarios aún</p></div>';
    } else {
        let html = '';
        comments.forEach((comment, index) => {
            html += `
                <div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${comment.user}</span>
                        <span class="comment-date">${formatDateTime(comment.date)}</span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-actions">
                        <button class="btn-danger btn-small" onclick="deleteComment('${taskId}', ${index})">🗑️ Eliminar</button>
                    </div>
                </div>
            `;
        });
        commentsList.innerHTML = html;
    }

    document.getElementById('commentsModal').classList.add('active');
}

window.closeCommentsModal = function() {
    document.getElementById('commentsModal').classList.remove('active');
    document.getElementById('newComment').value = '';
}

window.addComment = async function() {
    const taskId = document.getElementById('commentTaskId').value;
    const commentText = document.getElementById('newComment').value.trim();

    if (!commentText) {
        showToast('Escribe un comentario', 'warning');
        return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const comment = {
        text: commentText,
        user: currentUser.email,
        date: new Date().toISOString()
    };

    try {
        const comments = [...(task.comments || []), comment];
        await updateDoc(doc(db, 'tasks', taskId), { comments });
        
        showToast('💬 Comentario agregado', 'success');
        document.getElementById('newComment').value = '';
        await loadTasks();
        openCommentsModal(taskId);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

window.deleteComment = async function(taskId, commentIndex) {
    if (!confirm('¿Eliminar este comentario?')) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        const comments = [...(task.comments || [])];
        comments.splice(commentIndex, 1);
        
        await updateDoc(doc(db, 'tasks', taskId), { comments });
        
        showToast('Comentario eliminado', 'success');
        await loadTasks();
        openCommentsModal(taskId);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// ==================== HISTORIAL ====================
window.openHistoryModal = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const historyList = document.getElementById('historyList');
    const history = task.history || [];
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state"><p>No hay historial disponible</p></div>';
    } else {
        let html = '';
        history.forEach(entry => {
            html += `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-action">${entry.action}</span>
                        <span class="history-date">${formatDateTime(entry.date)}</span>
                    </div>
                    <div class="history-details">
                        <strong>Usuario:</strong> ${entry.user}<br>
                        <strong>Detalles:</strong> ${entry.details}
                    </div>
                </div>
            `;
        });
        historyList.innerHTML = html;
    }

    document.getElementById('historyModal').classList.add('active');
}

window.closeHistoryModal = function() {
    document.getElementById('historyModal').classList.remove('active');
}

// ==================== BÚSQUEDA ====================
window.searchTasks = function() {
    currentSearchTerm = document.getElementById('searchBox').value.toLowerCase().trim();
    filterTasks();
}

// ==================== FILTROS ====================
window.filterCurrentMonth = function() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('monthFilter').value = currentMonth;
    filterTasks();
    
    showToast('📅 Mostrando tareas del mes actual', 'success');
}

window.filterTasks = function() {
    const month = document.getElementById('monthFilter').value;
    const status = document.getElementById('statusFilter').value;
    const assignee = document.getElementById('assigneeFilter').value;
    const searchTerm = currentSearchTerm;

    let filtered = tasks;
    
    if (month) filtered = filtered.filter(t => t.date.startsWith(month));
    if (status) filtered = filtered.filter(t => t.status === status);
    if (assignee) filtered = filtered.filter(t => t.supportName === assignee);
    
    if (searchTerm) {
        filtered = filtered.filter(t => {
            const searchableText = `${t.user} ${t.description} ${(t.tags || []).join(' ')}`.toLowerCase();
            return searchableText.includes(searchTerm);
        });
    }

    displayTasksFiltered(filtered, month, status);
}

function displayTasksFiltered(filtered, month, status) {
    const container = document.getElementById('tasksContainer');

    const tasksByMonth = {};
    
    if (!status || status === 'En Progreso') {
        Object.entries(activeTasks).forEach(([taskId, task]) => {
            if (month && !task.date.startsWith(month)) return;
            
            if (currentSearchTerm) {
                const searchableText = `${task.user} ${task.description} ${(task.tags || []).join(' ')}`.toLowerCase();
                if (!searchableText.includes(currentSearchTerm)) return;
            }
            
            const monthKey = task.date.substring(0, 7);
            if (!tasksByMonth[monthKey]) {
                tasksByMonth[monthKey] = { active: [], completed: [] };
            }
            tasksByMonth[monthKey].active.push({ taskId, task });
        });

        Object.keys(tasksByMonth).forEach(monthKey => {
            tasksByMonth[monthKey].active.sort((a, b) => {
                const dateCompare = b.task.date.localeCompare(a.task.date);
                if (dateCompare !== 0) return dateCompare;
                return (b.task.startTime || '').localeCompare(a.task.startTime || '');
            });
        });
    }

    filtered.forEach(task => {
        const monthKey = task.date.substring(0, 7);
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = { active: [], completed: [] };
        }
        tasksByMonth[monthKey].completed.push(task);
    });

    const sortedMonths = Object.keys(tasksByMonth).sort().reverse();

    let html = '';

    if (sortedMonths.length === 0) {
        html = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h3>No hay tareas</h3>
                <p>No se encontraron tareas con los filtros seleccionados</p>
            </div>
        `;
    } else {
        sortedMonths.forEach(monthKey => {
            const monthData = tasksByMonth[monthKey];
            const hasActiveTasks = monthData.active.length > 0;
            const hasCompletedTasks = monthData.completed.length > 0;

            if (!hasActiveTasks && !hasCompletedTasks) return;

            html += `
                <div style="background: linear-gradient(135deg, #59acc6 0%, #a2c125 100%); color: white; padding: 15px 20px; border-radius: 12px; margin: 20px 0 15px 0; font-weight: 700; font-size: 1.2em; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    📅 ${formatMonth(monthKey)}
                </div>
            `;

            html += `
                <table class="tasks-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Soportista</th>
                            <th>Usuario/Servicio</th>
                            <th>Horario</th>
                            <th>Duración</th>
                            <th>Estado</th>
                            <th>Labor</th>
                            <th>Etiquetas</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            monthData.active.forEach(({ taskId, task }) => {
                const timer = getCurrentTimer(task);
                const tagsHtml = (task.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('');
                
                html += `
                    <tr class="active-task-row">
                        <td data-label="Fecha"><strong>${formatDate(task.date)}</strong></td>
                        <td data-label="Soportista">${task.supportName}</td>
                        <td data-label="Usuario"><strong>${task.user}</strong></td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - <strong>En curso</strong></td>
                        <td data-label="Duración"><span class="timer-badge">${timer}</span></td>
                        <td data-label="Estado"><span class="status-badge status-en-progreso">⏳ En Progreso</span></td>
                        <td data-label="Labor">${task.description}</td>
                        <td data-label="Etiquetas">${tagsHtml || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-warning btn-small" onclick="pauseTask('${taskId}')">${task.isPaused ? '▶️ Reanudar' : '⏸️ Pausar'}</button>
                                <button class="btn-primary btn-small" onclick="suspendTask('${taskId}')">💾 Suspender</button>
                                <button class="btn-success btn-small" onclick="completeTask('${taskId}')">✅ Finalizar</button>
                                <button class="btn-danger btn-small" onclick="cancelActiveTask('${taskId}')">❌ Cancelar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            monthData.completed.forEach(task => {
                const duration = calcDuration(task.startTime, task.endTime);
                const statusClass = getStatusClass(task.status);
                const isSuspended = task.status === 'Suspendida Temporalmente';
                const tagsHtml = (task.tags || []).map(tag => `<span class="tag-badge">${tag}</span>`).join('');
                
                html += `
                    <tr>
                        <td data-label="Fecha">${formatDate(task.date)}</td>
                        <td data-label="Soportista">${task.supportName || 'Kendall David Ali Gómez'}</td>
                        <td data-label="Usuario">${task.user}</td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}</td>
                        <td data-label="Duración"><span class="duration-badge">${duration}</span></td>
                        <td data-label="Estado"><span class="status-badge ${statusClass}">${task.status}</span></td>
                        <td data-label="Labor">${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}</td>
                        <td data-label="Etiquetas">${tagsHtml || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                ${isSuspended ? `<button class="btn-primary btn-small" onclick="resumeTask('${task.id}')">▶️ Retomar</button>` : ''}
                                <button class="btn-primary btn-small" onclick="openEditModal('${task.id}')">✏️ Editar</button>
                                <button class="btn-secondary btn-small" onclick="openCommentsModal('${task.id}')">💬 Comentarios</button>
                                <button class="btn-secondary btn-small" onclick="openHistoryModal('${task.id}')">📜 Historial</button>
                                <button class="btn-danger btn-small" onclick="deleteTask('${task.id}')">🗑️ Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        });
    }

    container.innerHTML = html;
}

// ==================== ELIMINAR ====================
window.deleteTask = async function(id) {
    if (!confirm('¿Eliminar esta tarea permanentemente?')) return;

    try {
        await deleteDoc(doc(db, 'tasks', id));
        showToast('✅ Tarea eliminada', 'success');
        await loadTasks();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

// ==================== ESTADÍSTICAS ====================
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const activeCount = Object.keys(activeTasks).length;
    const todayTasks = tasks.filter(t => t.date === today).length + Object.values(activeTasks).filter(t => t.date === today).length;
    const completed = tasks.filter(t => t.status === 'Completada').length;
    const inProgress = tasks.filter(t => t.status === 'En Progreso').length + activeCount;
    const suspended = tasks.filter(t => t.status === 'Suspendida Temporalmente').length;
    const closedUnsuccessful = tasks.filter(t => t.status === 'Cerrada sin éxito').length;

    document.getElementById('stats').innerHTML = `
        <div class="stat-card">
            <h3>${tasks.length + activeCount}</h3>
            <p>Total Tareas</p>
        </div>
        <div class="stat-card">
            <h3>${todayTasks}</h3>
            <p>Hoy</p>
        </div>
        <div class="stat-card">
            <h3>${completed}</h3>
            <p>Completadas</p>
        </div>
        <div class="stat-card">
            <h3>${inProgress}</h3>
            <p>En Progreso</p>
        </div>
        <div class="stat-card">
            <h3>${suspended}</h3>
            <p>Suspendidas</p>
        </div>
        <div class="stat-card">
            <h3>${closedUnsuccessful}</h3>
            <p>Sin Éxito</p>
        </div>
    `;
}

function populateFilters() {
    const taskMonths = tasks.map(t => t.date.substring(0, 7));
    const activeMonths = Object.values(activeTasks).map(t => t.date.substring(0, 7));
    const allMonths = [...new Set([...taskMonths, ...activeMonths])].sort().reverse();
    
    const monthFilter = document.getElementById('monthFilter');
    monthFilter.innerHTML = '<option value="">📅 Todos los meses</option>';
    allMonths.forEach(m => {
        monthFilter.innerHTML += `<option value="${m}">${formatMonth(m)}</option>`;
    });

    // Filtro de soportistas
    const assignees = [...new Set(tasks.map(t => t.supportName || 'Kendall David Ali Gómez'))];
    const assigneeFilter = document.getElementById('assigneeFilter');
    assigneeFilter.innerHTML = '<option value="">👨‍💼 Todos los soportistas</option>';
    assignees.forEach(assignee => {
        assigneeFilter.innerHTML += `<option value="${assignee}">${assignee}</option>`;
    });
}

// ==================== GRÁFICOS ====================
function updateCharts() {
    updateStatusChart();
    updateTrendChart();
}

function updateStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    const statusCounts = {
        'Completada': tasks.filter(t => t.status === 'Completada').length,
        'En Progreso': tasks.filter(t => t.status === 'En Progreso').length + Object.keys(activeTasks).length,
        'Suspendida': tasks.filter(t => t.status === 'Suspendida Temporalmente').length,
        'Cerrada sin éxito': tasks.filter(t => t.status === 'Cerrada sin éxito').length,
        'Cancelada': tasks.filter(t => t.status === 'Cancelada').length
    };

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    'rgba(162, 193, 37, 0.8)',
                    'rgba(89, 172, 198, 0.8)',
                    'rgba(255, 149, 0, 0.8)',
                    'rgba(255, 59, 48, 0.8)',
                    'rgba(134, 134, 139, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function updateTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Obtener últimos 6 meses
    const months = [];
    const counts = [];
    
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        // Nombres cortos para móviles
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = monthNames[date.getMonth()];
        months.push(monthName);
        
        const count = tasks.filter(t => t.date.startsWith(monthKey)).length;
        counts.push(count);
    }

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Tareas',
                data: counts,
                borderColor: 'rgba(89, 172, 198, 1)',
                backgroundColor: 'rgba(89, 172, 198, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// ==================== CALENDARIO ====================
function renderCalendar() {
    const calendarView = document.getElementById('calendarView');
    if (!calendarView) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    let html = `
        <h3 style="text-align: center; margin-bottom: 20px; color: var(--text-primary);">${monthNames[month]} ${year}</h3>
        <div class="calendar-container">
    `;

    // Días de la semana con clase
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        html += `<div class="calendar-header">${day}</div>`;
    });

    // Espacios vacíos antes del primer día
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.date === dateStr);
        const hasActiveTasks = Object.values(activeTasks).some(t => t.date === dateStr);
        const totalTasks = dayTasks.length + (hasActiveTasks ? 1 : 0);

        html += `
            <div class="calendar-day ${totalTasks > 0 ? 'has-tasks' : ''}">
                <div class="calendar-day-number">${day}</div>
                ${totalTasks > 0 ? `<div class="calendar-task-count">${totalTasks}</div>` : ''}
            </div>
        `;
    }

    html += '</div>';
    calendarView.innerHTML = html;
}

// ==================== REPORTES (EXCEL) ====================
function generateMonthButtons() {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let html = '';
    const currentYear = new Date().getFullYear();
    months.forEach((name, i) => {
        const value = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        html += `<button class="month-btn" onclick="exportMonthWithTemplate('${value}')">📅 ${name}</button>`;
    });
    document.getElementById('monthSelector').innerHTML = html;
}

window.toggleMonthSelector = function() {
    document.getElementById('monthSelector').classList.toggle('hidden');
}

window.exportToExcelWithTemplate = async function() {
    if (tasks.length === 0) {
        showToast('No hay tareas para exportar', 'error');
        return;
    }

    try {
        showToast('📊 Preparando reporte profesional...', 'warning');

        const wb = XLSX.utils.book_new();
        const ws = {};

        ws['!cols'] = [
            { wch: 25 },
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 15 },
            { wch: 50 }
        ];

        ws['!rows'] = [
            { hpt: 80 },
            { hpt: 30 },
            { hpt: 25 },
            { hpt: 5 },
            { hpt: 25 }
        ];

        ws['A1'] = { 
            t: 's', 
            v: '📷 Insertar logo.png y cafsa.png aquí',
            s: {
                font: { sz: 11, color: { rgb: "808080" }, italic: true },
                alignment: { vertical: 'center', horizontal: 'center' }
            }
        };
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

        ws['A2'] = { 
            t: 's', 
            v: 'REPORTE DE LABORES SOPORTE TI',
            s: {
                font: { sz: 18, bold: true, color: { rgb: "2C5F2D" } },
                alignment: { vertical: 'center', horizontal: 'center' },
                fill: { fgColor: { rgb: "E8F5E9" } }
            }
        };
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });

        const currentDate = new Date();
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const currentMonth = monthNames[currentDate.getMonth()];
        const currentYear = currentDate.getFullYear();

        ws['A3'] = { 
            t: 's', 
            v: `${currentMonth} ${currentYear}`,
            s: {
                font: { sz: 14, bold: true, color: { rgb: "1565C0" } },
                alignment: { vertical: 'center', horizontal: 'center' }
            }
        };
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } });

        const headers = ['Soportista', 'Fecha', 'Usuario Atendido', 'Horario', 'Estado', 'Labor Realizada'];
        headers.forEach((header, i) => {
            const cell = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cell] = {
                t: 's',
                v: header,
                s: {
                    font: { sz: 14, bold: true, color: { rgb: "000000" }, name: 'Calibri' },
                    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                    fill: { fgColor: { rgb: "FFF8DC" } },
                    border: {
                        top: { style: 'thin', color: { rgb: "000000" } },
                        bottom: { style: 'thin', color: { rgb: "000000" } },
                        left: { style: 'thin', color: { rgb: "000000" } },
                        right: { style: 'thin', color: { rgb: "000000" } }
                    }
                }
            };
        });

        const sortedTasks = [...tasks].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.startTime || '').localeCompare(a.startTime || '');
        });

        sortedTasks.forEach((task, index) => {
            const row = 5 + index;
            
            const data = [
                task.supportName || 'Kendall David Ali Gómez',
                formatDate(task.date),
                task.user,
                `${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}`,
                task.status,
                task.description
            ];

            data.forEach((value, col) => {
                const cell = XLSX.utils.encode_cell({ r: row, c: col });
                ws[cell] = {
                    t: 's',
                    v: value,
                    s: {
                        font: { sz: 11, name: 'Calibri' },
                        alignment: { 
                            vertical: 'center', 
                            horizontal: col === 5 ? 'left' : 'center',
                            wrapText: col === 5
                        },
                        border: {
                            top: { style: 'thin', color: { rgb: "CCCCCC" } },
                            bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
                            left: { style: 'thin', color: { rgb: "CCCCCC" } },
                            right: { style: 'thin', color: { rgb: "CCCCCC" } }
                        }
                    }
                };
            });
        });

        const lastRow = 5 + sortedTasks.length;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 5 } });

        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Soporte TI');

        const fileName = `Reporte_Soporte_TI_${currentMonth}_${currentYear}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast('✅ Reporte profesional exportado. Recuerda insertar los logos (logo.png y cafsa.png) en la primera fila.', 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast('❌ Error al exportar: ' + error.message, 'error');
    }
}

window.exportMonthWithTemplate = async function(month) {
    const filtered = tasks.filter(t => t.date.startsWith(month));

    if (filtered.length === 0) {
        showToast(`No hay tareas en ${formatMonth(month)}`, 'error');
        return;
    }

    try {
        showToast('📊 Preparando reporte profesional...', 'warning');

        const wb = XLSX.utils.book_new();
        const ws = {};

        ws['!cols'] = [
            { wch: 25 },
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 15 },
            { wch: 50 }
        ];

        ws['!rows'] = [
            { hpt: 80 },
            { hpt: 30 },
            { hpt: 25 },
            { hpt: 5 },
            { hpt: 25 }
        ];

        ws['A1'] = { 
            t: 's', 
            v: '📷 Insertar logo.png y cafsa.png aquí',
            s: {
                font: { sz: 11, color: { rgb: "808080" }, italic: true },
                alignment: { vertical: 'center', horizontal: 'center' }
            }
        };
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

        ws['A2'] = { 
            t: 's', 
            v: 'REPORTE DE LABORES SOPORTE TI',
            s: {
                font: { sz: 18, bold: true, color: { rgb: "2C5F2D" } },
                alignment: { vertical: 'center', horizontal: 'center' },
                fill: { fgColor: { rgb: "E8F5E9" } }
            }
        };
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });

        const [year, monthNum] = month.split('-');
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = monthNames[parseInt(monthNum) - 1];

        ws['A3'] = { 
            t: 's', 
            v: `${monthName} ${year}`,
            s: {
                font: { sz: 14, bold: true, color: { rgb: "1565C0" } },
                alignment: { vertical: 'center', horizontal: 'center' }
            }
        };
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } });

        const headers = ['Soportista', 'Fecha', 'Usuario Atendido', 'Horario', 'Estado', 'Labor Realizada'];
        headers.forEach((header, i) => {
            const cell = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cell] = {
                t: 's',
                v: header,
                s: {
                    font: { sz: 14, bold: true, color: { rgb: "000000" }, name: 'Calibri' },
                    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                    fill: { fgColor: { rgb: "FFF8DC" } },
                    border: {
                        top: { style: 'thin', color: { rgb: "000000" } },
                        bottom: { style: 'thin', color: { rgb: "000000" } },
                        left: { style: 'thin', color: { rgb: "000000" } },
                        right: { style: 'thin', color: { rgb: "000000" } }
                    }
                }
            };
        });

        const sortedFiltered = [...filtered].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.startTime || '').localeCompare(a.startTime || '');
        });

        sortedFiltered.forEach((task, index) => {
            const row = 5 + index;
            
            const data = [
                task.supportName || 'Kendall David Ali Gómez',
                formatDate(task.date),
                task.user,
                `${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}`,
                task.status,
                task.description
            ];

            data.forEach((value, col) => {
                const cell = XLSX.utils.encode_cell({ r: row, c: col });
                ws[cell] = {
                    t: 's',
                    v: value,
                    s: {
                        font: { sz: 11, name: 'Calibri' },
                        alignment: { 
                            vertical: 'center', 
                            horizontal: col === 5 ? 'left' : 'center',
                            wrapText: col === 5
                        },
                        border: {
                            top: { style: 'thin', color: { rgb: "CCCCCC" } },
                            bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
                            left: { style: 'thin', color: { rgb: "CCCCCC" } },
                            right: { style: 'thin', color: { rgb: "CCCCCC" } }
                        }
                    }
                };
            });
        });

        const lastRow = 5 + sortedFiltered.length;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 5 } });

        XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`);

        const fileName = `Reporte_Soporte_TI_${monthName}_${year}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast(`✅ Reporte de ${monthName} ${year} exportado. Recuerda insertar los logos en la primera fila.`, 'success');
    } catch (error) {
        console.error('Error al exportar:', error);
        showToast('❌ Error al exportar: ' + error.message, 'error');
    }
}

window.exportByStatus = function() {
    const wb = XLSX.utils.book_new();
    const statuses = ['Completada', 'En Progreso', 'Suspendida Temporalmente', 'Cerrada sin éxito', 'Cancelada'];
    let hasData = false;

    statuses.forEach(status => {
        const filtered = tasks.filter(t => t.status === status);
        if (filtered.length > 0) {
            hasData = true;
            
            const ws = {};

            ws['!cols'] = [
                { wch: 25 },
                { wch: 12 },
                { wch: 30 },
                { wch: 20 },
                { wch: 15 },
                { wch: 50 }
            ];

            ws['!rows'] = [
                { hpt: 30 },
                { hpt: 25 }
            ];

            ws['A1'] = { 
                t: 's', 
                v: `REPORTE: ${status.toUpperCase()}`,
                s: {
                    font: { sz: 16, bold: true, color: { rgb: "2C5F2D" } },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    fill: { fgColor: { rgb: "E8F5E9" } }
                }
            };
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

            const headers = ['Soportista', 'Fecha', 'Usuario Atendido', 'Horario', 'Estado', 'Labor Realizada'];
            headers.forEach((header, i) => {
                const cell = XLSX.utils.encode_cell({ r: 1, c: i });
                ws[cell] = {
                    t: 's',
                    v: header,
                    s: {
                        font: { sz: 14, bold: true, name: 'Calibri' },
                        alignment: { vertical: 'center', horizontal: 'center' },
                        fill: { fgColor: { rgb: "FFF8DC" } },
                        border: {
                            top: { style: 'thin', color: { rgb: "000000" } },
                            bottom: { style: 'thin', color: { rgb: "000000" } },
                            left: { style: 'thin', color: { rgb: "000000" } },
                            right: { style: 'thin', color: { rgb: "000000" } }
                        }
                    }
                };
            });

            const sortedFiltered = [...filtered].sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return (b.startTime || '').localeCompare(a.startTime || '');
            });

            sortedFiltered.forEach((task, index) => {
                const row = 2 + index;
                const data = [
                    task.supportName || 'Kendall David Ali Gómez',
                    formatDate(task.date),
                    task.user,
                    `${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}`,
                    task.status,
                    task.description
                ];

                data.forEach((value, col) => {
                    const cell = XLSX.utils.encode_cell({ r: row, c: col });
                    ws[cell] = {
                        t: 's',
                        v: value,
                        s: {
                            font: { sz: 11, name: 'Calibri' },
                            alignment: { 
                                vertical: 'center', 
                                horizontal: col === 5 ? 'left' : 'center',
                                wrapText: col === 5
                            },
                            border: {
                                top: { style: 'thin', color: { rgb: "CCCCCC" } },
                                bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
                                left: { style: 'thin', color: { rgb: "CCCCCC" } },
                                right: { style: 'thin', color: { rgb: "CCCCCC" } }
                            }
                        }
                    };
                });
            });

            const lastRow = 2 + sortedFiltered.length;
            ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 5 } });

            XLSX.utils.book_append_sheet(wb, ws, status.substring(0, 31));
        }
    });

    if (!hasData) {
        showToast('No hay tareas', 'error');
        return;
    }

    XLSX.writeFile(wb, `Reportes_por_Estado_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('🏷️ Reportes por estado exportados', 'success');
}

// ==================== FUNCIONES AUXILIARES ====================
function calcDuration(start, end) {
    if (!start || !end) return '-';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let min = (eh * 60 + em) - (sh * 60 + sm);
    if (min < 0) min += 24 * 60;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
}

function getStatusClass(status) {
    const map = {
        'Completada': 'status-completada',
        'En Progreso': 'status-en-progreso',
        'Suspendida Temporalmente': 'status-suspendida',
        'Cerrada sin éxito': 'status-cerrada-sin-exito',
        'Cancelada': 'status-cancelada'
    };
    return map[status] || 'status-completada';
}

function formatTime12h(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function formatDate(date) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
}

function formatMonth(month) {
    const [y, m] = month.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div style="font-weight: 600;">${message}</div>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    updateLogos(newTheme);
    
    showToast(newTheme === 'dark' ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado', 'success');
}

window.toggleSettingsMenu = function() {
    const menu = document.getElementById('settingsMenu');
    menu.classList.toggle('active');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    const iconMobile = document.getElementById('themeIconMobile');
    const textMobile = document.getElementById('themeTextMobile');
    
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    
    if (iconMobile && textMobile) {
        iconMobile.textContent = theme === 'dark' ? '☀️' : '🌙';
        textMobile.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
    }
}

function updateLogos(theme) {
    const loginLogo = document.getElementById('loginLogo');
    const headerLogo = document.getElementById('headerLogo');
    const logoSrc = theme === 'dark' ? 'logo_noche.png' : 'logo.png';
    
    if (loginLogo) loginLogo.src = logoSrc;
    if (headerLogo) headerLogo.src = logoSrc;
}

// Cerrar modales y menú al hacer clic fuera
window.onclick = function(event) {
    // Cerrar modales
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
    
    // Cerrar menú de ajustes
    if (event.target.classList.contains('settings-menu')) {
        event.target.classList.remove('active');
    }
}
