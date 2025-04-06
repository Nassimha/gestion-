document.addEventListener('DOMContentLoaded', function() {
    // Get alert data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const alertData = {
        ref: decodeJsonParam(urlParams.get('ref')),
        address: decodeJsonParam(urlParams.get('address')),
        name: decodeJsonParam(urlParams.get('name')),
        category: decodeJsonParam(urlParams.get('category')),
        current: parseInt(decodeJsonParam(urlParams.get('current'))) || 0,
        min: parseInt(decodeJsonParam(urlParams.get('min'))) || 0,
        max: parseInt(decodeJsonParam(urlParams.get('max'))) || 0,
        timestamp: decodeJsonParam(urlParams.get('time')) || new Date().toISOString(),
        stock_curve: decodeJsonParam(urlParams.get('stock_curve')) || [],
        history: decodeJsonParam(urlParams.get('history')) || [],
        consumption: decodeJsonParam(urlParams.get('consumption')) || [],
        movements: decodeJsonParam(urlParams.get('movements')) || []
    };

    // Helper function to decode JSON parameters
    function decodeJsonParam(param) {
        if (!param) return null;
        try {
            return JSON.parse(decodeURIComponent(param));
        } catch (e) {
            console.error('Error parsing parameter:', e);
            return param;
        }
    }

    // Update UI with alert data
    const elements = {
        itemRef: alertData.ref || 'N/A',
        itemName: alertData.name || 'N/A',
        itemAddress: alertData.address || 'N/A',
        itemCategory: alertData.category || 'Non catégorisé',  // Valeur par défaut modifiée
        currentStock: alertData.current,
        minStock: alertData.min,
        maxStock: alertData.max,
        alertTime: new Date(alertData.timestamp).toLocaleString()
    };

    // Update all elements
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

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
    // Vérification et préparation des données
    console.log("Data received:", data); // Debug log

    // Dimensions fixes pour les conteneurs de graphiques
    document.querySelectorAll('.chart-container').forEach(container => {
        container.style.height = '300px';
        container.style.width = '100%';
        container.style.minHeight = '300px';
        container.style.position = 'relative';
    });

    // Convertir et valider les données d'historique
    let historyData = [];
    try {
        historyData = Array.isArray(data.history) ? data.history : [];
        historyData = historyData.map(h => ({
            date: new Date(h.date),
            quantity: parseInt(h.quantity) || 0
        }));
    } catch (e) {
        console.error("Error parsing history data:", e);
        historyData = [];
    }

    // Convertir et valider les données de la courbe de stock
    let stockCurveData = [];
    try {
        stockCurveData = Array.isArray(data.stock_curve) ? 
            data.stock_curve.map(Number) : 
            historyData.map(h => h.quantity);
    } catch (e) {
        console.error("Error parsing stock curve data:", e);
        stockCurveData = [];
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

    // Graphique de répartition du stock
    const categoryCtx = document.getElementById('categoryStockChart');
    if (categoryCtx) {
        new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['Stock actuel', 'Stock minimum', 'Stock disponible'],
                datasets: [{
                    data: [
                        parseInt(data.current) || 0,
                        parseInt(data.min) || 0,
                        Math.max(0, (parseInt(data.max) || 0) - (parseInt(data.current) || 0))
                    ],
                    backgroundColor: [
                        '#1976d2',
                        '#f44336',
                        '#4CAF50'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: { size: 12 },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => ({
                                        text: `${label}: ${data.datasets[0].data[i]}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        index: i
                                    }));
                                }
                                return [];
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: `Répartition du Stock - ${data.category || 'Non catégorisé'}`,
                        font: { size: 16, weight: 'bold' }
                    }
                }
            }
        });
    }

    // Graphique des tendances
    const trendsCtx = document.getElementById('categoryTrendsChart');
    if (trendsCtx) {
        // Convertir et valider stock_curve
        let stockCurveData = [];
        try {
            stockCurveData = Array.isArray(data.stock_curve) ? 
                data.stock_curve.map(Number) : 
                JSON.parse(data.stock_curve).map(Number);
        } catch (e) {
            console.error("Error parsing stock_curve:", e);
            stockCurveData = [];
        }

        // Générer des dates pour l'axe X
        const dates = Array.from({length: stockCurveData.length}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (stockCurveData.length - i - 1));
            return date;
        });

        new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Évolution du stock',
                    data: stockCurveData,
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Évolution du Stock',
                        padding: 20,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: true }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: { day: 'DD/MM' }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            source: 'auto',
                            maxRotation: 45,
                            autoSkip: true
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    updateCategoryMetrics(data);
}

// Ajouter une fonction pour mettre à jour les graphiques
function updateCharts(newData) {
    const charts = Object.values(Chart.instances);
    charts.forEach(chart => {
        if (chart.canvas.id === 'categoryStockChart') {
            chart.data.datasets[0].data = [
                newData.current,
                newData.min,
                Math.max(0, newData.max - newData.current)
            ];
        } else if (chart.canvas.id === 'categoryTrendsChart' && newData.history) {
            chart.data.labels = newData.history.map(h => new Date(h.date));
            chart.data.datasets[0].data = newData.history.map(h => h.quantity);
        }
        chart.update();
    });
}

function updateCategoryMetrics(data) {
    const metrics = {
        categoryTotalStock: `${data.current || 0} unités`,
        categoryAvgConsumption: `${calculateAverageConsumption(data)} unités/jour`,
        categoryStockout: `${calculateDaysUntilCritical(data)} jours`
    };

    Object.entries(metrics).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            // Ajouter une classe d'animation
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 1000);
        }
    });
}

// Ajouter des animations pour les mouvements
function displayMovements(movements) {
    const movementList = document.getElementById('movementList');
    if (!movementList || !Array.isArray(movements)) return;

    movementList.innerHTML = '';
    movements.forEach((mov, index) => {
        if (!mov.date || !mov.type || !mov.quantity) return;

        const item = document.createElement('div');
        item.className = 'movement-item';
        const date = new Date(mov.date);
        if (isNaN(date.getTime())) return;

        item.innerHTML = `
            <div class="movement-icon ${mov.type === 'in' ? 'in' : 'out'}">
                ${mov.type === 'in' ? '↑' : '↓'}
            </div>
            <div class="movement-details">
                <span class="movement-quantity">${mov.quantity} unités</span>
                <span class="movement-date">${date.toLocaleDateString()}</span>
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
