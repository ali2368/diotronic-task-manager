import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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

// Inicializar autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').textContent = user.email.split('@')[0];
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
}

function checkActiveTask() {
    const saved = localStorage.getItem('activeTasks');
    if (saved) {
        activeTasks = JSON.parse(saved);
        startTimer();
        displayTasks();
    }
}

window.startNewTask = function() {
    const user = document.getElementById('quickUser').value.trim();
    const desc = document.getElementById('quickDesc').value.trim();

    if (!user) {
        showToast('Por favor ingresa el usuario/servicio', 'error');
        return;
    }

    const now = new Date();
    const taskId = 'task_' + now.getTime();
    
    activeTasks[taskId] = {
        id: taskId,
        supportName: 'Kendall David Ali Gómez',
        date: now.toISOString().split('T')[0],
        user,
        startTime: now.toTimeString().split(' ')[0].substring(0, 5),
        startTimestamp: now.getTime(),
        description: desc || 'En progreso...',
        status: 'En Progreso',
        pausedTime: 0,
        isPaused: false
    };

    localStorage.setItem('activeTasks', JSON.stringify(activeTasks));
    
    document.getElementById('quickUser').value = '';
    document.getElementById('quickDesc').value = '';
    
    startTimer();
    displayTasks();
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
        showToast('⏸️ Tarea pausada', 'warning');
    } else {
        task.startTimestamp = Date.now() - (task.pausedTime || 0);
        task.pausedTime = 0;
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
            accumulatedTime: elapsedTime,
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
        pausedTime: task.accumulatedTime || 0,
        isPaused: false,
        originalTaskId: taskId
    };

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

    try {
        delete task.id;
        delete task.startTimestamp;
        delete task.pausedTime;
        delete task.isPaused;
        delete task.originalTaskId;
        delete task.accumulatedTime;
        
        await addDoc(collection(db, 'tasks'), {
            ...task,
            createdAt: new Date().toISOString()
        });

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

window.addManualTask = async function(e) {
    e.preventDefault();

    const task = {
        supportName: 'Kendall David Ali Gómez',
        date: document.getElementById('manualDate').value,
        user: document.getElementById('manualUser').value,
        startTime: document.getElementById('manualStart').value,
        endTime: document.getElementById('manualEnd').value,
        description: document.getElementById('manualDesc').value,
        status: 'Completada',
        createdAt: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, 'tasks'), task);
        
        showToast('✅ Tarea guardada correctamente', 'success');
        document.getElementById('manualForm').reset();
        document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
        await loadTasks();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

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
    } catch (error) {
        showToast('Error al cargar: ' + error.message, 'error');
    }
}

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
                            <th>Usuario/Servicio</th>
                            <th>Horario</th>
                            <th>Duración</th>
                            <th>Estado</th>
                            <th>Labor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            monthData.active.forEach(({ taskId, task }) => {
                const timer = getCurrentTimer(task);
                html += `
                    <tr class="active-task-row">
                        <td data-label="Fecha"><strong>${formatDate(task.date)}</strong></td>
                        <td data-label="Usuario"><strong>${task.user}</strong></td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - <strong>En curso</strong></td>
                        <td data-label="Duración"><span class="timer-badge">${timer}</span></td>
                        <td data-label="Estado"><span class="status-badge status-en-progreso">⏳ En Progreso</span></td>
                        <td data-label="Labor">${task.description}</td>
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
                
                html += `
                    <tr>
                        <td data-label="Fecha">${formatDate(task.date)}</td>
                        <td data-label="Usuario">${task.user}</td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}</td>
                        <td data-label="Duración"><span class="duration-badge">${duration}</span></td>
                        <td data-label="Estado"><span class="status-badge ${statusClass}">${task.status}</span></td>
                        <td data-label="Labor">${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}</td>
                        <td>
                            <div class="action-buttons">
                                ${isSuspended ? `<button class="btn-primary btn-small" onclick="resumeTask('${task.id}')">▶️ Retomar</button>` : ''}
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

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const activeCount = Object.keys(activeTasks).length;
    const todayTasks = tasks.filter(t => t.date === today).length + Object.values(activeTasks).filter(t => t.date === today).length;
    const completed = tasks.filter(t => t.status === 'Completada').length;
    const inProgress = tasks.filter(t => t.status === 'En Progreso').length + activeCount;
    const suspended = tasks.filter(t => t.status === 'Suspendida Temporalmente').length;
    const closedUnsuccessful = tasks.filter(t => t.status === 'Cerrada sin éxito').length;

    let totalHours = 0;
    tasks.forEach(t => {
        if (t.startTime && t.endTime && (t.status === 'Completada' || t.status === 'Cerrada sin éxito')) {
            const [sh, sm] = t.startTime.split(':').map(Number);
            const [eh, em] = t.endTime.split(':').map(Number);
            totalHours += ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        }
    });

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
        <div class="stat-card">
            <h3>${totalHours.toFixed(1)}h</h3>
            <p>Horas Totales</p>
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
}

window.filterTasks = function() {
    const month = document.getElementById('monthFilter').value;
    const status = document.getElementById('statusFilter').value;

    let filtered = tasks;
    if (month) filtered = filtered.filter(t => t.date.startsWith(month));
    if (status) filtered = filtered.filter(t => t.status === status);

    displayTasksFiltered(filtered, month, status);
}

function displayTasksFiltered(filtered, month, status) {
    const container = document.getElementById('tasksContainer');

    const tasksByMonth = {};
    
    if (!status || status === 'En Progreso') {
        Object.entries(activeTasks).forEach(([taskId, task]) => {
            if (month && !task.date.startsWith(month)) return;
            
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
                            <th>Usuario/Servicio</th>
                            <th>Horario</th>
                            <th>Duración</th>
                            <th>Estado</th>
                            <th>Labor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            monthData.active.forEach(({ taskId, task }) => {
                const timer = getCurrentTimer(task);
                html += `
                    <tr class="active-task-row">
                        <td data-label="Fecha"><strong>${formatDate(task.date)}</strong></td>
                        <td data-label="Usuario"><strong>${task.user}</strong></td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - <strong>En curso</strong></td>
                        <td data-label="Duración"><span class="timer-badge">${timer}</span></td>
                        <td data-label="Estado"><span class="status-badge status-en-progreso">⏳ En Progreso</span></td>
                        <td data-label="Labor">${task.description}</td>
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
                
                html += `
                    <tr>
                        <td data-label="Fecha">${formatDate(task.date)}</td>
                        <td data-label="Usuario">${task.user}</td>
                        <td data-label="Horario">${formatTime12h(task.startTime)} - ${formatTime12h(task.endTime)}</td>
<td data-label="Duración"><span class="duration-badge">${duration}</span></td>
                        <td data-label="Estado"><span class="status-badge ${statusClass}">${task.status}</span></td>
                        <td data-label="Labor">${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}</td>
                        <td>
                            <div class="action-buttons">
                                ${isSuspended ? `<button class="btn-primary btn-small" onclick="resumeTask('${task.id}')">▶️ Retomar</button>` : ''}
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

function generateMonthButtons() {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    let html = '';
    months.forEach((name, i) => {
        const value = `2025-${String(i + 1).padStart(2, '0')}`;
        html += `<button class="month-btn" onclick="exportMonthWithTemplate('${value}')">📅 ${name}</button>`;
    });
    document.getElementById('monthSelector').innerHTML = html;
}

window.toggleMonthSelector = function() {
    document.getElementById('monthSelector').classList.toggle('hidden');
}

// ==================== EXPORTAR A EXCEL CON DISEÑO PROFESIONAL ====================

window.exportToExcelWithTemplate = async function() {
    if (tasks.length === 0) {
        showToast('No hay tareas para exportar', 'error');
        return;
    }

    try {
        showToast('📊 Preparando reporte profesional...', 'warning');

        const wb = XLSX.utils.book_new();
        const ws = {};

        // Configurar anchos de columna
        ws['!cols'] = [
            { wch: 25 }, // A - Soportista
            { wch: 12 }, // B - Fecha
            { wch: 30 }, // C - Usuario
            { wch: 20 }, // D - Horario
            { wch: 15 }, // E - Estado
            { wch: 50 }  // F - Labor
        ];

        // Configurar alturas de fila
        ws['!rows'] = [
            { hpt: 80 },  // Fila 1 - Logo
            { hpt: 30 },  // Fila 2 - Título
            { hpt: 25 },  // Fila 3 - Mes/Año
            { hpt: 5 },   // Fila 4 - Espacio
            { hpt: 25 }   // Fila 5 - Encabezados
        ];

        // Fila 1: Espacio para logo (instrucciones)
        ws['A1'] = { 
            t: 's', 
            v: '📷 Insertar logo.png y cafsa.png aquí',
            s: {
                font: { sz: 11, color: { rgb: "808080" }, italic: true },
                alignment: { vertical: 'center', horizontal: 'center' }
            }
        };
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

        // Fila 2: Título principal
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

        // Fila 3: Mes y Año
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

        // Fila 5: Encabezados de columnas con fondo crema
        const headers = ['Soportista', 'Fecha', 'Usuario Atendido', 'Horario', 'Estado', 'Labor Realizada'];
        headers.forEach((header, i) => {
            const cell = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cell] = {
                t: 's',
                v: header,
                s: {
                    font: { sz: 14, bold: true, color: { rgb: "000000" }, name: 'Calibri' },
                    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
                    fill: { fgColor: { rgb: "FFF8DC" } }, // Color crema
                    border: {
                        top: { style: 'thin', color: { rgb: "000000" } },
                        bottom: { style: 'thin', color: { rgb: "000000" } },
                        left: { style: 'thin', color: { rgb: "000000" } },
                        right: { style: 'thin', color: { rgb: "000000" } }
                    }
                }
            };
        });

        // Ordenar tareas por fecha
        const sortedTasks = [...tasks].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.startTime || '').localeCompare(a.startTime || '');
        });

        // Fila 6 en adelante: Datos
        sortedTasks.forEach((task, index) => {
            const row = 5 + index; // Empezar desde fila 6 (índice 5)
            
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

        // Definir rango
        const lastRow = 5 + sortedTasks.length;
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 5 } });

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Soporte TI');

        // Descargar archivo
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

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

function updateLogos(theme) {
    const loginLogo = document.getElementById('loginLogo');
    const headerLogo = document.getElementById('headerLogo');
    const logoSrc = theme === 'dark' ? 'logo_noche.png' : 'logo.png';
    
    if (loginLogo) loginLogo.src = logoSrc;
    if (headerLogo) headerLogo.src = logoSrc;
}