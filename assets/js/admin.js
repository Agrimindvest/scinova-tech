// ============================================================
// SCINOVATECH - ADMIN LOGIC (Supabase)
// ============================================================

const ADMIN_CREDENTIALS = {
    email: 'scinovatech@gmail.com',
    pass: 'SCINOVA-ADMIN-2026'
};

let isAdminLoggedIn = false;
let emergencyStopState = false;

// ============ DASHBOARD ============
async function loadDashboard() {
    try {
        // Load starter slots
        await loadStarterSlotsAdmin();

        const { data: users, error: uErr } = await sb.from('users').select('*');
        if (uErr) throw uErr;

        const { data: payments } = await sb.from('payments').select('amount').eq('status', 'approved');
        const { data: withdrawals } = await sb.from('withdrawals').select('amount').eq('status', 'approved');
        const { data: pendingDep } = await sb.from('deposits').select('id').eq('status', 'pending');
        const { data: pendingWth } = await sb.from('withdrawals').select('id').eq('status', 'pending');

        document.getElementById('sUsers').textContent = users.length;
        document.getElementById('sActive').textContent = users.filter(u => u.plan && u.plan !== 'none').length;
        document.getElementById('sInvested').textContent = fmt((payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
        document.getElementById('sPaid').textContent = fmt((withdrawals || []).reduce((s, w) => s + Number(w.amount || 0), 0));
        document.getElementById('sPendingDep').textContent = (pendingDep || []).length;
        document.getElementById('sPendingWth').textContent = (pendingWth || []).length;
    } catch (error) {
        console.error('Dashboard error:', error);
        toast('Error loading dashboard');
    }
}

async function loadStarterSlotsAdmin() {
    try {
        const slots = await getStarterSlots();
        const big = document.getElementById('slotBig');
        const remaining = document.getElementById('slotRemaining');
        const fill = document.getElementById('slotFill');
        const dateEl = document.getElementById('slotDate');

        if (!big) return;

        big.textContent = slots.used + ' / ' + slots.limit;
        dateEl.textContent = slots.date;
        fill.style.width = ((slots.used / slots.limit) * 100) + '%';

        if (slots.remaining > 0) {
            remaining.textContent = slots.remaining + ' slots remaining today';
            remaining.style.color = 'var(--cyan)';
        } else {
            remaining.textContent = '🔴 SOLD OUT — resets at midnight WAT';
            remaining.style.color = 'var(--danger)';
        }
    } catch (e) {
        console.error('loadStarterSlotsAdmin error:', e);
    }
}

// ============ USERS ============
async function loadUsers() {
    try {
        const { data: users, error } = await sb.from('users').select('*');
        if (error) throw error;

        const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
        let html = '';

        if (!users || users.length === 0) {
            html = '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);">No users found</td></tr>';
        } else {
            users.forEach(u => {
                if (search && !(u.name || '').toLowerCase().includes(search) && !(u.email || '').includes(search)) return;
                const statusClass = u.status === 'active' ? 'success' : 'danger';
                html += `<tr>
                    <td>${u.id}</td>
                    <td>${u.name || ''}</td>
                    <td>${u.email || ''}</td>
                    <td>${u.phone || ''}</td>
                    <td>${u.plan || 'None'}</td>
                    <td>${fmt(u.balance || 0)}</td>
                    <td><span class="badge badge-${statusClass}">${u.status || 'active'}</span></td>
                    <td>
                        <button class="btn-sm btn-primary" onclick="editUser('${u.id}')">Edit</button>
                        <button class="btn-sm btn-success" onclick="quickAdd('${u.id}','${(u.name || '').replace(/'/g, "\\'")}')">+₦</button>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('usersTable').innerHTML = html;
    } catch (error) {
        console.error('Load users error:', error);
        document.getElementById('usersTable').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:var(--danger);">Error loading users</td></tr>';
    }
}

async function quickAdd(id, name) {
    const amount = prompt('Add balance to ' + name + '\n\nAmount (₦):', '500');
    if (!amount) return;
    const amt = parseInt(amount);
    if (!amt || amt <= 0) return toast('Invalid amount');
    if (!confirm('Add ₦' + amt.toLocaleString() + ' to ' + name + '?')) return;

    try {
        await sb.rpc('increment_user_field', {
            p_user_id: id, p_field: 'balance', p_amount: amt
        });

        await sb.from('deposits').insert({
            user_id: id,
            user_name: name,
            amount: amt,
            channel: 'admin',
            status: 'approved',
            ref: 'ADMIN-BONUS'
        });

        toast('✅ Added ₦' + amt.toLocaleString());
        loadUsers();
        loadDashboard();
    } catch (error) {
        console.error('Quick add error:', error);
        toast('❌ Failed to add balance');
    }
}

async function editUser(id) {
    try {
        const u = await getDoc('users', id);
        if (!u) return toast('User not found');

        const action = prompt(
            `Edit: ${u.name}\nBalance: ${fmt(u.balance)}\nPlan: ${u.plan || 'None'}\nStatus: ${u.status}\n\n` +
            `Commands:\n"status active/suspended"\n"add 5000"\n"remove 2000"\n"plan gold/none"`
        );
        if (!action) return;

        const parts = action.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        const val = parts[1];

        if (cmd === 'status' && ['active', 'suspended'].includes(val)) {
            await sb.from('users').update({ status: val }).eq('id', id);
            toast('✅ Status: ' + val);
        }
        else if (cmd === 'add' && parseInt(val) > 0) {
            const amt = parseInt(val);
            await sb.rpc('increment_user_field', {
                p_user_id: id, p_field: 'balance', p_amount: amt
            });
            toast('✅ Added ₦' + amt.toLocaleString());
        }
        else if (cmd === 'remove' && parseInt(val) > 0) {
            const amt = parseInt(val);
            const currentBalance = u.balance || 0;
            if (amt > currentBalance) {
                toast('❌ User only has ' + fmt(currentBalance));
                return;
            }
            await sb.rpc('increment_user_field', {
                p_user_id: id, p_field: 'balance', p_amount: -amt
            });
            toast('✅ Removed ₦' + amt.toLocaleString());
        }
        else if (cmd === 'plan') {
            if (val === 'none') {
                await sb.from('users').update({ plan: 'none', invested: false }).eq('id', id);
                toast('✅ Plan removed');
            } else {
                const plans = await getAllPlans();
                if (plans[val]) {
                    const exp = new Date();
                    exp.setDate(exp.getDate() + (plans[val].daysValid || 90));
                    const currentOwned = Array.isArray(u.ownedPlans) ? u.ownedPlans : [];
                    const newOwned = [...currentOwned, val];
                    await sb.from('users').update({
                        plan: val,
                        expiry_date: exp.toISOString(),
                        invested: true,
                        owned_plans: newOwned
                    }).eq('id', id);
                    toast('✅ Plan: ' + plans[val].name);
                } else {
                    toast('❌ Plan not found');
                }
            }
        } else {
            toast('❌ Unknown command');
        }

        loadUsers();
        loadDashboard();
    } catch (error) {
        console.error('Edit user error:', error);
        toast('❌ Error editing user');
    }
}

// ============ DEPOSITS ============
async function loadDeposits() {
    try {
        const { data, error } = await sb
            .from('deposits').select('*')
            .order('date', { ascending: false })
            .limit(50);
        if (error) throw error;

        const search = (document.getElementById('depositSearch')?.value || '').toLowerCase();
        let html = '';

        if (!data || data.length === 0) {
            html = '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);">No deposits found</td></tr>';
        } else {
            data.forEach(dep => {
                const userName = dep.user_name || dep.user_id || '';
                if (search && !userName.toLowerCase().includes(search) && !(dep.ref || '').toLowerCase().includes(search)) return;
                const statusClass = dep.status === 'approved' ? 'success' : dep.status === 'pending' ? 'warning' : 'danger';
                const statusLabel = dep.status === 'approved' ? '✅ Approved' : dep.status === 'pending' ? '⏳ Pending' : '❌ Rejected';

                html += `<tr>
                    <td>${userName}</td>
                    <td>${fmt(dep.amount)}</td>
                    <td>${dep.ref || '-'}</td>
                    <td>${dep.payer_name || '-'}</td>
                    <td>${dep.payer_account || '-'}</td>
                    <td>${new Date(dep.date).toLocaleDateString()}</td>
                    <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
                    <td>
                        ${dep.status === 'pending'
                            ? `<button class="btn-sm btn-success" onclick="approveDeposit('${dep.id}')">Approve</button>
                               <button class="btn-sm btn-danger" onclick="rejectDeposit('${dep.id}')">Reject</button>`
                            : '✅ Processed'}
                    </td>
                </tr>`;
            });
        }
        document.getElementById('depositsTable').innerHTML = html;
    } catch (error) {
        console.error('Load deposits error:', error);
        document.getElementById('depositsTable').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:var(--danger);">Error loading deposits</td></tr>';
    }
}

async function approveDeposit(id) {
    if (!confirm('✅ Approve this deposit?')) return;
    try {
        const dep = await getDoc('deposits', id);
        if (!dep) return toast('❌ Deposit not found');

        await sb.from('deposits').update({
            status: 'approved',
            processed_at: new Date().toISOString()
        }).eq('id', id);

        await sb.rpc('increment_user_field', {
            p_user_id: dep.userId || dep.user_id,
            p_field: 'balance',
            p_amount: Number(dep.amount)
        });

        toast('✅ Deposit approved! ₦' + Number(dep.amount).toLocaleString() + ' added');
        loadDeposits();
        loadDashboard();
    } catch (error) {
        console.error('Approve deposit error:', error);
        toast('❌ Failed: ' + error.message);
    }
}

async function rejectDeposit(id) {
    if (!confirm('❌ Reject this deposit?')) return;
    try {
        await sb.from('deposits').update({
            status: 'rejected',
            processed_at: new Date().toISOString()
        }).eq('id', id);
        toast('❌ Deposit rejected');
        loadDeposits();
        loadDashboard();
    } catch (error) {
        console.error('Reject deposit error:', error);
        toast('❌ Failed: ' + error.message);
    }
}

// ============ WITHDRAWALS ============
async function loadWithdrawals() {
    try {
        const { data, error } = await sb
            .from('withdrawals').select('*')
            .order('date', { ascending: false })
            .limit(50);
        if (error) throw error;

        const search = (document.getElementById('withdrawalSearch')?.value || '').toLowerCase();
        let html = '';

        if (!data || data.length === 0) {
            html = '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);">No withdrawals found</td></tr>';
        } else {
            data.forEach(w => {
                const userName = w.user_name || w.user_id || '';
                if (search && !userName.toLowerCase().includes(search) && !(w.bank_name || '').toLowerCase().includes(search)) return;
                const statusClass = w.status === 'approved' ? 'success' : w.status === 'pending' ? 'warning' : 'danger';
                const statusLabel = w.status === 'approved' ? '✅ Approved' : w.status === 'pending' ? '⏳ Pending' : '❌ Rejected';

                html += `<tr>
                    <td>${userName}</td>
                    <td>${fmt(w.amount)}</td>
                    <td>${fmt(w.fee)}</td>
                    <td>${fmt(w.net)}</td>
                    <td>${w.bank_name || '-'}<br><small>${w.acct_no || ''}</small></td>
                    <td>${new Date(w.date).toLocaleDateString()}</td>
                    <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
                    <td>
                        ${w.status === 'pending'
                            ? `<button class="btn-sm btn-success" onclick="approveWithdrawal('${w.id}')">Approve</button>
                               <button class="btn-sm btn-danger" onclick="rejectWithdrawal('${w.id}')">Reject</button>`
                            : '✅ Processed'}
                    </td>
                </tr>`;
            });
        }
        document.getElementById('withdrawalsTable').innerHTML = html;
    } catch (error) {
        console.error('Load withdrawals error:', error);
        document.getElementById('withdrawalsTable').innerHTML =
            '<tr><td colspan="8" style="text-align:center;color:var(--danger);">Error loading withdrawals</td></tr>';
    }
}

async function approveWithdrawal(id) {
    if (!confirm('✅ Approve this withdrawal?')) return;
    try {
        const w = await getDoc('withdrawals', id);
        if (!w) return toast('❌ Withdrawal not found');

        await sb.from('withdrawals').update({
            status: 'approved',
            processed_at: new Date().toISOString()
        }).eq('id', id);

        toast('✅ Withdrawal approved! ₦' + Number(w.net).toLocaleString() + ' to send');
        loadWithdrawals();
        loadDashboard();
    } catch (error) {
        console.error('Approve withdrawal error:', error);
        toast('❌ Failed: ' + error.message);
    }
}

async function rejectWithdrawal(id) {
    if (!confirm('❌ Reject this withdrawal and refund user?')) return;
    try {
        const w = await getDoc('withdrawals', id);
        if (!w) return toast('❌ Withdrawal not found');

        await sb.from('withdrawals').update({
            status: 'rejected',
            processed_at: new Date().toISOString()
        }).eq('id', id);

        await sb.rpc('increment_user_field', {
            p_user_id: w.userId || w.user_id,
            p_field: 'balance',
            p_amount: Number(w.amount)
        });

        toast('❌ Rejected - ₦' + Number(w.amount).toLocaleString() + ' refunded');
        loadWithdrawals();
        loadDashboard();
    } catch (error) {
        console.error('Reject withdrawal error:', error);
        toast('❌ Failed: ' + error.message);
    }
}

// ============ ARTICLES ============
async function loadContent() {
    try {
        const { data, error } = await sb.from('articles').select('*').order('date', { ascending: false });
        if (error) throw error;

        let html = '';
        if (!data || data.length === 0) {
            html = '<p style="color:var(--text-dim);text-align:center;padding:20px;">No custom articles yet. Users see the 10 built-in science articles.</p>';
        } else {
            data.forEach(a => {
                html += `<div class="card" style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                        <div>
                            <strong style="color:var(--cyan);">${a.title}</strong>
                            <div style="font-size:0.7em;color:var(--text-dim);margin-top:4px;">
                                ${a.category || 'Uncategorized'} • ${a.difficulty || 'Beginner'}
                            </div>
                        </div>
                        <button class="btn-sm btn-danger" onclick="deleteArticle('${a.id}')">Delete</button>
                    </div>
                </div>`;
            });
        }
        document.getElementById('articlesAdminList').innerHTML = html;
    } catch (error) {
        console.error('Load content error:', error);
        document.getElementById('articlesAdminList').innerHTML = '<p style="color:var(--danger);">Error loading articles</p>';
    }
}

async function showAddArticle() {
    document.getElementById('addArticleForm').style.display = 'block';
    document.getElementById('aTitle').value = '';
    document.getElementById('aContent').value = '';

    // Populate categories
    const cats = await getCategories();
    const catSel = document.getElementById('aCategory');
    catSel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

    // 3 questions
    let qHTML = '';
    for (let i = 1; i <= 3; i++) {
        qHTML += `<div class="card" style="margin-bottom:10px;">
            <strong style="color:var(--cyan);">Q${i}</strong>
            <input type="text" class="form-input" id="q${i}q" placeholder="Question" style="margin:8px 0 5px;">
            <input type="text" class="form-input" placeholder="Option A" id="q${i}a" style="margin-bottom:3px;">
            <input type="text" class="form-input" placeholder="Option B" id="q${i}b" style="margin-bottom:3px;">
            <input type="text" class="form-input" placeholder="Option C" id="q${i}c" style="margin-bottom:5px;">
            <label style="font-size:0.8em;color:var(--text-dim);">Correct: 
                <select class="form-input" id="q${i}ans" style="display:inline-block;width:auto;padding:4px 8px;">
                    <option value="0">A</option>
                    <option value="1">B</option>
                    <option value="2">C</option>
                </select>
            </label>
        </div>`;
    }
    document.getElementById('questionsContainer').innerHTML = qHTML;
}

async function saveArticle() {
    try {
        const t = document.getElementById('aTitle').value.trim();
        const c = document.getElementById('aContent').value.trim();
        const cat = document.getElementById('aCategory').value;
        const diff = document.getElementById('aDifficulty').value;
        if (!t || !c) return toast('Fill title and content');

        const qs = [];
        for (let i = 1; i <= 3; i++) {
            qs.push({
                q: document.getElementById('q' + i + 'q').value,
                o: [
                    document.getElementById('q' + i + 'a').value,
                    document.getElementById('q' + i + 'b').value,
                    document.getElementById('q' + i + 'c').value
                ],
                a: parseInt(document.getElementById('q' + i + 'ans').value)
            });
        }

        const { error } = await sb.from('articles').insert({
            title: t,
            content: c,
            category: cat,
            difficulty: diff,
            qs: qs,
            status: 'active'
        });
        if (error) throw error;

        toast('✅ Article saved!');
        document.getElementById('addArticleForm').style.display = 'none';
        loadContent();
    } catch (error) {
        console.error('Save article error:', error);
        toast('❌ Failed to save article');
    }
}

async function deleteArticle(id) {
    if (confirm('Delete?')) {
        try {
            await sb.from('articles').delete().eq('id', id);
            toast('Deleted');
            loadContent();
        } catch (e) { toast('Failed to delete'); }
    }
}

// ============ REFERRALS ============
async function loadReferrals() {
    try {
        const { data, error } = await sb
            .from('referrals').select('*')
            .order('date', { ascending: false })
            .limit(50);
        if (error) throw error;

        let html = '';
        if (!data || data.length === 0) {
            html = '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);">No referrals found</td></tr>';
        } else {
            data.forEach(r => {
                html += `<tr>
                    <td>${r.referrer_id}</td>
                    <td>${r.referee_name || r.referee_id}</td>
                    <td><span class="badge badge-info">L${r.level || 1}</span></td>
                    <td>${r.package || '-'}</td>
                    <td>${fmt(r.earned || 0)}</td>
                    <td>${new Date(r.date).toLocaleDateString()}</td>
                </tr>`;
            });
        }
        document.getElementById('refTable').innerHTML = html;
    } catch (error) {
        console.error('Load referrals error:', error);
        document.getElementById('refTable').innerHTML =
            '<tr><td colspan="6" style="text-align:center;color:var(--danger);">Error loading referrals</td></tr>';
    }
}

// ============ TASK REPORTS ============
async function loadTaskReports() {
    const dateInput = document.getElementById('taskDateFilter');
    const date = dateInput?.value || getLocalDate();
    if (dateInput && !dateInput.value) dateInput.value = date;

    const container = document.getElementById('taskReportsList');
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="spinner"></div>
            <p>Loading tasks for ${date}...</p>
        </div>`;

    try {
        const tasks = await getAllUserTasksForDate(date);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No tasks completed on ${date}</p>
                </div>`;
            return;
        }

        let html = '';
        let totalCompleted = 0;
        let totalEarned = 0;

        tasks.forEach(task => {
            const tlist = task.tasks || [];
            const completed = tlist.filter(t => t.done).length;
            const earned = tlist.reduce((sum, t) => sum + (t.earned || 0), 0);
            const progress = (completed / 3) * 100;

            totalCompleted += completed;
            totalEarned += earned;

            html += `
                <div class="task-report-item">
                    <div class="user-info">
                        <span class="name">${task.userId || task.user_id}</span>
                        <span class="id">${completed}/3 questions completed${task.readingRewardClaimed ? ' • ✅ Reading' : ''}</span>
                    </div>
                    <div class="task-stats">
                        <span class="completed">✅ ${completed}/3</span>
                        <div class="progress">
                            <div class="fill" style="width:${progress}%;"></div>
                        </div>
                        <span class="earned">${fmt(earned)}</span>
                    </div>
                </div>`;
        });

        html = `
            <div class="card" style="border-color:var(--gold);margin-bottom:15px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <span style="color:var(--gold);font-weight:700;">📊 Daily Summary - ${date}</span>
                    <span>Total Users: <strong>${tasks.length}</strong></span>
                    <span>Total Questions: <strong>${totalCompleted}</strong></span>
                    <span>Total Earned: <strong style="color:var(--gold);">${fmt(totalEarned)}</strong></span>
                </div>
            </div>` + html;

        container.innerHTML = html;
    } catch (error) {
        console.error('Load task reports error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error loading tasks. Please refresh.</p>
            </div>`;
    }
}

// ============ PLANS ============
async function loadPlansAdmin() {
    try {
        let plans = await getAllPlans();

        if (!plans || Object.keys(plans).length === 0) {
            plans = DEFAULT_PLANS;
            await sb.from('settings').upsert({ key: 'plans', value: DEFAULT_PLANS });
        }

        let html = '';
        const sortedKeys = Object.keys(plans).sort((a, b) => (plans[a].price || 0) - (plans[b].price || 0));

        sortedKeys.forEach(key => {
            const p = plans[key];
            const icon = p.status === 'active' ? '🟢' : p.status === 'disabled' ? '🔒' : '🔴';
            const daily = Math.floor((p.price || 0) * ((p.dailyRate || 15) / 100));
            const perTask = Math.floor(daily / 3);
            const total90 = daily * (p.daysValid || 90);

            html += `<div class="card" style="opacity:${p.status === 'active' ? '1' : '0.6'}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div>
                        <strong>${icon} ${p.name || key}</strong>
                        <br><small style="color:var(--text-dim);">${fmt(p.price || 0)} • Daily: ${fmt(daily)} • Task: ${fmt(perTask)} • ${p.daysValid || 90}d</small>
                        <br><small style="color:var(--cyan);">Total Return: ${fmt(total90)} • Rate: ${p.dailyRate || 15}%</small>
                        <br><small style="color:var(--text-mute);">Key: ${key}</small>
                    </div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap;">
                        ${p.status === 'active'
                            ? `<button class="btn-sm btn-warning" onclick="togglePlan('${key}','disabled')">Disable</button>`
                            : p.status === 'disabled'
                                ? `<button class="btn-sm btn-success" onclick="togglePlan('${key}','active')">Enable</button>`
                                : `<button class="btn-sm btn-success" onclick="togglePlan('${key}','active')">Activate</button>`}
                        <button class="btn-sm btn-danger" onclick="togglePlan('${key}','soldout')">Sold Out</button>
                        <button class="btn-sm btn-primary" onclick="editPlanValues('${key}')">✏️ Edit</button>
                    </div>
                </div>
            </div>`;
        });

        document.getElementById('plansAdminList').innerHTML = html;
    } catch (error) {
        console.error('Load plans error:', error);
        document.getElementById('plansAdminList').innerHTML =
            '<p style="color:var(--danger);">Error loading plans. <button class="btn-sm btn-primary" onclick="loadPlansAdmin()">Retry</button></p>';
    }
}

async function togglePlan(key, status) {
    try {
        const plans = await getAllPlans();
        if (plans[key]) {
            plans[key].status = status;
            await sb.from('settings').upsert({ key: 'plans', value: plans });
            loadPlansAdmin();
            toast('✅ Plan status: ' + status);
        }
    } catch (error) {
        console.error('Toggle plan error:', error);
        toast('❌ Failed');
    }
}

async function editPlanValues(key) {
    try {
        const plans = await getAllPlans();
        const p = plans[key];
        if (!p) return toast('Plan not found');

        const name = prompt('Plan name:', p.name); if (!name) return;
        const price = parseInt(prompt('Price (₦):', p.price)); if (!price) return;
        const dailyRate = parseFloat(prompt('Daily Rate (%):', p.dailyRate || 15)); if (!dailyRate) return;
        const daysValid = parseInt(prompt('Validity (days):', p.daysValid || 90)); if (!daysValid) return;

        plans[key] = { ...p, name, price, dailyRate, daysValid };
        await sb.from('settings').upsert({ key: 'plans', value: plans });
        loadPlansAdmin();
        toast('✅ Plan updated!');
    } catch (error) {
        console.error('Edit plan error:', error);
        toast('❌ Failed');
    }
}

function showAddPlan() {
    const key = prompt('Plan key (lowercase, e.g. "titan"):'); if (!key) return;
    const name = prompt('Plan name:'); if (!name) return;
    const price = parseInt(prompt('Price (₦):')); if (!price) return;
    const dailyRate = parseFloat(prompt('Daily Rate (%):', '15')) || 15;
    const daysValid = parseInt(prompt('Validity (days):', '90')) || 90;
    const totalLimit = parseInt(prompt('Purchase limit (total):', '2')) || 2;

    getAllPlans().then(plans => {
        plans[key.toLowerCase()] = {
            name, price, dailyRate, daysValid,
            limitType: 'total', totalLimit,
            status: 'disabled',
            order: 99
        };
        return sb.from('settings').upsert({ key: 'plans', value: plans });
    }).then(() => {
        loadPlansAdmin();
        toast('✅ Plan added!');
    }).catch(error => {
        console.error('Add plan error:', error);
        toast('❌ Failed');
    });
}

// ============ NOTICES ============
async function loadNotices() {
    try {
        const n = await getDoc('settings', 'notices');
        if (n) {
            document.getElementById('noticeDeposit').value = n.deposit || '';
            document.getElementById('noticeWithdrawal').value = n.withdrawal || '';
            document.getElementById('noticeHome').value = n.home || '';
            document.getElementById('noticeTasks').value = n.tasks || '';
        }
    } catch (error) { console.error('Load notices error:', error); }
}

async function saveNotices() {
    try {
        await sb.from('settings').upsert({
            key: 'notices',
            value: {
                deposit: document.getElementById('noticeDeposit').value,
                withdrawal: document.getElementById('noticeWithdrawal').value,
                home: document.getElementById('noticeHome').value,
                tasks: document.getElementById('noticeTasks').value
            },
            updated_at: new Date().toISOString()
        });
        toast('✅ Notices saved!');
    } catch (error) {
        console.error('Save notices error:', error);
        toast('❌ Failed');
    }
}

async function sendBroadcast() {
    try {
        const msg = document.getElementById('broadMsg').value;
        if (!msg) return toast('Enter message');
        const dur = parseInt(document.getElementById('broadDuration').value) || 24;

        await sb.from('settings').upsert({
            key: 'broadcast',
            value: {
                message: msg,
                expiry: Date.now() + dur * 3600000,
                date: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
        });
        toast('✅ Broadcast sent!');
        document.getElementById('broadMsg').value = '';
    } catch (error) {
        console.error('Send broadcast error:', error);
        toast('❌ Failed');
    }
}

// ============ SETTINGS ============
async function loadSettingsData() {
    try {
        const s = await getDoc('settings', 'siteSettings');
        if (s) {
            document.getElementById('setTelegram').value = s.telegramLink || '';
            document.getElementById('setSupportEmail').value = s.supportEmail || '';
        }

        const p = await getDoc('settings', 'site');
        if (p) {
            document.getElementById('setBonus').value = p.welcomeBonus || 500;
            document.getElementById('setReadingReward').value = p.readingReward || 100;
            document.getElementById('setReadingMinutes').value = p.readingMinutes || 5;
            document.getElementById('setTasksPerDay').value = p.tasksPerDay || 3;
            document.getElementById('setWithdrawalFee').value = p.withdrawalFeePct || 13;
            document.getElementById('setPayoutCap').value = p.payoutCapMultiplier || 3;
            emergencyStopState = p.emergencyStop || false;
            updateEmergencyToggleUI();
        }

        const w = await getDoc('settings', 'withdrawalSettings');
        if (w) {
            document.getElementById('setWithdrawalMin').value = w.min_withdrawal || 600;
            document.getElementById('setWithdrawalStart').value = w.start_time || '08:00';
            document.getElementById('setWithdrawalEnd').value = w.end_time || '22:00';
            document.getElementById('setWithdrawalWeekday').value = w.max_weekday || 1;
            document.getElementById('setWithdrawalWeekend').value = w.max_weekend || 2;
        }

        const r = await getDoc('settings', 'site');
        if (r) {
            document.getElementById('setRef1').value = r.ref1 || 10;
            document.getElementById('setRef2').value = r.ref2 || 3;
            document.getElementById('setRef3').value = r.ref3 || 1;
        }
    } catch (error) { console.error('Load settings error:', error); }
}

function updateEmergencyToggleUI() {
    const toggle = document.getElementById('toggleEmergencyStop');
    if (toggle) {
        if (emergencyStopState) toggle.classList.add('on');
        else toggle.classList.remove('on');
    }
}

function toggleEmergencyStop() {
    emergencyStopState = !emergencyStopState;
    updateEmergencyToggleUI();
    if (emergencyStopState) {
        if (!confirm('⚠️ This will FREEZE all daily earnings. Confirm?')) {
            emergencyStopState = false;
            updateEmergencyToggleUI();
        }
    }
}

async function saveSettings() {
    try {
        await sb.from('settings').upsert([
            {
                key: 'siteSettings',
                value: {
                    telegramLink: document.getElementById('setTelegram').value,
                    supportEmail: document.getElementById('setSupportEmail').value
                },
                updated_at: new Date().toISOString()
            },
            {
                key: 'site',
                value: {
                    welcomeBonus: parseInt(document.getElementById('setBonus').value) || 500,
                    readingReward: parseInt(document.getElementById('setReadingReward').value) || 100,
                    readingMinutes: parseInt(document.getElementById('setReadingMinutes').value) || 5,
                    tasksPerDay: parseInt(document.getElementById('setTasksPerDay').value) || 3,
                    withdrawalFeePct: parseInt(document.getElementById('setWithdrawalFee').value) || 13,
                    minWithdrawal: parseInt(document.getElementById('setWithdrawalMin').value) || 600,
                    minDeposit: 3000,
                    payoutCapMultiplier: parseInt(document.getElementById('setPayoutCap').value) || 3,
                    emergencyStop: emergencyStopState,
                    ref1: parseInt(document.getElementById('setRef1').value) || 10,
                    ref2: parseInt(document.getElementById('setRef2').value) || 3,
                    ref3: parseInt(document.getElementById('setRef3').value) || 1
                },
                updated_at: new Date().toISOString()
            },
            {
                key: 'withdrawalSettings',
                value: {
                    min_withdrawal: parseInt(document.getElementById('setWithdrawalMin').value) || 600,
                    start_time: document.getElementById('setWithdrawalStart').value || '08:00',
                    end_time: document.getElementById('setWithdrawalEnd').value || '22:00',
                    max_weekday: parseInt(document.getElementById('setWithdrawalWeekday').value) || 1,
                    max_weekend: parseInt(document.getElementById('setWithdrawalWeekend').value) || 2
                },
                updated_at: new Date().toISOString()
            }
        ]);
        toast('✅ Settings saved!');
    } catch (error) {
        console.error('Save settings error:', error);
        toast('❌ Failed');
    }
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

console.log('🛡️ SciNovaTech Admin JS Ready');
