document.addEventListener('DOMContentLoaded', function() {
    // Get alert data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const alertData = {
        ref: urlParams.get('ref') || 'N/A',
        name: urlParams.get('name') || 'N/A',
        category: urlParams.get('category') || 'N/A',
        current: parseInt(urlParams.get('current')) || 0,
        min: parseInt(urlParams.get('min')) || 0,
        max: parseInt(urlParams.get('max')) || 0,
        timestamp: urlParams.get('time') || new Date().toISOString(),
        history: JSON.parse(urlParams.get('history') || '[]'),
        consumption: JSON.parse(urlParams.get('consumption') || '[]'),
        movements: JSON.parse(urlParams.get('movements') || '[]')
    };

    // Update UI with alert data
    document.getElementById('itemRef').textContent = alertData.ref;
    document.getElementById('itemName').textContent = alertData.name;
    document.getElementById('itemCategory').textContent = alertData.category;
    document.getElementById('currentStock').textContent = alertData.current;
    document.getElementById('minStock').textContent = alertData.min;
    document.getElementById('maxStock').textContent = alertData.max;
    document.getElementById('alertTime').textContent = new Date(alertData.timestamp).toLocaleString();

    // Calculate and update progress bar
    const stockRatio = (alertData.current / alertData.max) * 100;
    const progressBar = document.getElementById('stockProgress');
    progressBar.style.width = `${Math.min(stockRatio, 100)}%`;

    // Generate recommendations
    const recommendationsList = document.getElementById('recommendationsList');
    const recommendations = generateRecommendations(alertData);
    recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recommendationsList.appendChild(li);
    });

    // Initialiser les nouvelles sections
    initCharts(alertData);
    displayMovements(alertData.movements);
    displayForecast(alertData);
    initPSZStyles();
});

function generateRecommendations(data) {
    const recommendations = [];
    const deficit = data.min - data.current;
    const optimalOrder = Math.ceil(deficit * 1.5); // Commander 150% du déficit

    if (data.current <= data.min) {
        recommendations.push(`Commander immédiatement ${optimalOrder} unités pour restaurer le stock optimal`);
        recommendations.push(`Vérifier les derniers mouvements de stock pour analyser la consommation`);
    }

    if (data.current < data.min * 0.5) {
        recommendations.push(`⚠️ URGENT: Niveau critique atteint, commande prioritaire requise`);
        recommendations.push(`Envisager une révision du stock minimum (actuellement ${data.min})`);
    }

    recommendations.push(`Prochain audit de stock recommandé: ${getNextAuditDate()}`);
    return recommendations;
}

function getNextAuditDate() {
    const now = new Date();
    const nextAudit = new Date(now.setDate(now.getDate() + 7));
    return nextAudit.toLocaleDateString();
}

// Ajouter cette fonction pour mettre à jour l'heure en temps réel
function updateCurrentTime() {
    const timeElement = document.getElementById('currentTime');
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString();
}

// Améliorer l'initialisation des graphiques
function initCharts(data) {
    // Vérifier et parser les données d'historique
    let historyData = [];
    try {
        if (typeof data.history === 'string') {
            historyData = JSON.parse(data.history);
        } else {
            historyData = data.history;
        }
    } catch (e) {
        console.error('Erreur parsing historique:', e);
        historyData = [];
    }

    // Vérifier et parser les données de mouvements
    let movementsData = [];
    try {
        if (typeof data.movements === 'string') {
            movementsData = JSON.parse(data.movements);
        } else {
            movementsData = data.movements;
        }
    } catch (e) {
        console.error('Erreur parsing mouvements:', e);
        movementsData = [];
    }

    // Configuration des couleurs
    const chartColors = {
        stockLine: '#005DA9',
        inFlow: '#4CAF50',
        outFlow: '#f44336',
        grid: '#E5E5E5',
    };

    // Graphique d'historique du stock
    const stockCtx = document.getElementById('stockHistoryChart').getContext('2d');
    new Chart(stockCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Niveau de Stock',
                data: historyData.map(h => ({
                    x: new Date(h.date),
                    y: h.quantity
                })),
                borderColor: chartColors.stockLine,
                fill: true,
                tension: 0.4,
                backgroundColor: 'rgba(0, 93, 169, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'DD/MM/YY'
                        }
                    },
                    grid: {
                        color: chartColors.grid
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartColors.grid
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });

    // Graphique des mouvements
    const movementCtx = document.getElementById('consumptionChart').getContext('2d');
    new Chart(movementCtx, {
        type: 'bar',
        data: {
            datasets: [
                {
                    label: 'Entrées',
                    data: movementsData.filter(m => m.type === 'in').map(m => ({
                        x: new Date(m.date),
                        y: m.quantity
                    })),
                    backgroundColor: chartColors.inFlow,
                    stack: 'stack0'
                },
                {
                    label: 'Sorties',
                    data: movementsData.filter(m => m.type === 'out').map(m => ({
                        x: new Date(m.date),
                        y: -m.quantity // Valeur négative pour les sorties
                    })),
                    backgroundColor: chartColors.outFlow,
                    stack: 'stack0'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    stacked: true,
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    stacked: true,
                    grid: {
                        color: chartColors.grid
                    }
                }
            }
        }
    });
}

// Ajouter des animations pour les mouvements
function displayMovements(movements) {
    const movementList = document.getElementById('movementList');
    movementList.innerHTML = ''; // Clear existing items

    movements.forEach((mov, index) => {
        const item = document.createElement('div');
        item.className = 'movement-item';
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.innerHTML = `
            <div class="movement-icon ${mov.type === 'in' ? 'in' : 'out'}">
                ${mov.type === 'in' ? '↑' : '↓'}
            </div>
            <div class="movement-details">
                <span class="movement-quantity">${mov.quantity} unités</span>
                <span class="movement-date">${new Date(mov.date).toLocaleDateString()}</span>
            </div>
        `;
        movementList.appendChild(item);

        // Animate each item with delay
        setTimeout(() => {
            item.style.transition = 'all 0.5s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function displayForecast(data) {
    const forecastDiv = document.getElementById('forecastDetails');
    const daysUntilCritical = calculateDaysUntilCritical(data);
    
    forecastDiv.innerHTML = `
        <div class="forecast-item">
            <h4>Prévision Rupture de Stock</h4>
            <p class="forecast-value ${daysUntilCritical < 7 ? 'critical' : 'normal'}">
                ${daysUntilCritical} jours
            </p>
        </div>
        <div class="forecast-item">
            <h4>Consommation Moyenne</h4>
            <p class="forecast-value">
                ${calculateAverageConsumption(data)} unités/jour
            </p>
        </div>
    `;
}

function calculateDaysUntilCritical(data) {
    const avgConsumption = calculateAverageConsumption(data);
    const currentStock = data.current;
    const minStock = data.min;
    return Math.floor((currentStock - minStock) / avgConsumption);
}

function calculateAverageConsumption(data) {
    const consumption = data.consumption;
    return Math.round(consumption.reduce((a, b) => a + b, 0) / consumption.length);
}

// Start the clock update
setInterval(updateCurrentTime, 1000);
updateCurrentTime();

// Ajouter après le code existant
function initPSZStyles() {
    // Mettre à jour l'année dans le footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Appliquer le style PSZ aux graphiques
    Chart.defaults.color = '#58595B';
    Chart.defaults.font.family = "'Source Sans Pro', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = '#005DA9';
}

// Ajouter des animations aux panneaux
document.querySelectorAll('.panel').forEach(panel => {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'panelSlideUp 0.6s ease forwards';
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(panel);
});

// Ajouter des effets de parallaxe
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    document.querySelectorAll('.chart-container').forEach(container => {
        const speed = 0.5;
        container.style.transform = `translateY(${scrolled * speed}px)`;
    });
});
