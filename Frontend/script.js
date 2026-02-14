const API_URL  = "http://localhost:3000";
        let currentSpotId = null;
        let reservationModal = new bootstrap.Modal(document.getElementById('reserveModal'));

        // 1. Fetch Data
        async function fetchSpots() {
            try {
                const response = await fetch(`${API_URL}/places`);
                if(!response.ok) throw new Error("API Error");
                
                const spots = await response.json();
                renderGrid(spots);
                updateStats(spots);
                
                // Status Indicator
                const statusBadge = document.getElementById('connection-status');
                statusBadge.className = "badge bg-success px-3 py-2 rounded-pill";
                statusBadge.innerText = "System Online";
                
            } catch (error) {
                console.error("Connection Failed:", error);
                const statusBadge = document.getElementById('connection-status');
                statusBadge.className = "badge bg-danger px-3 py-2 rounded-pill";
                statusBadge.innerText = "API Offline";
            }
        }

        // 2. Render Grid
        function renderGrid(spots) {
            const container = document.getElementById('parking-container');
            container.innerHTML = ''; 

            if(spots.length === 0) {
                container.innerHTML = '<div class="col-12 text-center text-muted">No parking spots configured. Use the Admin panel to add one.</div>';
                return;
            }

            // Sort spots alphabetically
            spots.sort((a, b) => a.id.localeCompare(b.id));

            spots.forEach(spot => {
                const div = document.createElement('div');
                div.className = `spot-card status-${spot.status}`;
                
                // Determine Icon
                let iconClass = 'fa-check-circle'; // FREE
                if(spot.status === 'OCCUPIED') iconClass = 'fa-car';
                if(spot.status === 'RESERVED') iconClass = 'fa-user-lock';

                div.innerHTML = `
                    <button onclick="deleteSpot('${spot.id}', event)" class="btn btn-danger btn-sm btn-delete shadow" title="Delete Spot">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <i class="fas ${iconClass} fa-3x mb-2"></i>
                    <h4 class="mb-0 fw-bold">${spot.id}</h4>
                    <span class="badge bg-dark bg-opacity-25 mt-2">${spot.status}</span>
                    
                    ${spot.reserved_by ? `<div class="mt-2 small text-warning fw-bold"><i class="fas fa-user me-1"></i>${spot.reserved_by}</div>` : ''}
                `;
                
                // Click behavior (Only allow clicking if FREE to reserve)
                div.onclick = (e) => {
                    if(e.target.closest('.btn-delete')) return;
                    toggleStatus(spot.id, spot.status);
                };

                
                container.appendChild(div);
            });
        }

        // 3. Stats Logic
        function updateStats(spots) {
            document.getElementById('count-free').innerText = spots.filter(s => s.status === 'FREE').length;
            document.getElementById('count-occupied').innerText = spots.filter(s => s.status === 'OCCUPIED').length;
        }

        // 4. Admin: Add Spot
        document.getElementById('add-spot-form').onsubmit = async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('new-spot-id').value.toUpperCase();
            const row = document.getElementById('new-spot-row').value;

            const response = await fetch(`${API_URL}/places`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id, row: row })
            });

            if(response.ok) {
                document.getElementById('new-spot-id').value = '';
                fetchSpots(); 
            } else {
                const err = await response.json();
                alert("Error: " + (err.detail));
            }
        };

        // 5. Admin: Delete Spot
        async function deleteSpot(id, event) {
            // Stop event bubbling (don't trigger the card click)
            if(event) event.stopPropagation();
            
            if(confirm(`Are you sure you want to permanently delete spot ${id}?`)) {
                await fetch(`${API_URL}/places/${id}`, { method: 'DELETE' });
                fetchSpots();
            }
        }

        async function toggleStatus(id, currentStatus) {
            const newStatus = currentStatus === "FREE" ? "OCCUPIED" : "FREE";

            const response = await fetch(`${API_URL}/places/${id}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if(response.ok) {
                fetchSpots();
            } else {
                alert("Failed to update status");
            }
        }


        // Start Loop
        setInterval(fetchSpots, 2000); // Auto-refresh every 2 seconds
        fetchSpots(); // Initial load