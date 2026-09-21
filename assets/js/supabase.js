// ============================================================
// SCINOVATECH — SUPABASE CLIENT + HELPERS
// Updated with: feature toggles, broadcast, suspension support
// ============================================================

const SUPABASE_URL = 'https://mmcfqglrczyzjseqpwyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tY2ZxZ2xyY3p5empzZXFwd3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4ODc5NTksImV4cCI6MjEwNTQ2Mzk1OX0.5_sACqGx2_ast47gYfPBCXW8QsUJdgfw4nGErVzLRBw';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ SESSION CACHE ============
const CACHE_TTL = 5 * 60 * 1000;
function cacheSet(key, value) {
    try {
        sessionStorage.setItem('scn_cache_' + key, JSON.stringify({ v: value, t: Date.now() }));
    } catch (e) {}
}
function cacheGet(key) {
    try {
        const raw = sessionStorage.getItem('scn_cache_' + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.t > CACHE_TTL) {
            sessionStorage.removeItem('scn_cache_' + key);
            return null;
        }
        return parsed.v;
    } catch (e) { return null; }
}
function cacheClear(key) {
    try {
        if (key) sessionStorage.removeItem('scn_cache_' + key);
        else Object.keys(sessionStorage)
            .filter(k => k.startsWith('scn_cache_'))
            .forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}
}

// ============ CONSTANTS ============
const ADMIN_EMAIL = 'scinovatech2@gmail.com';   // ← updated
const BRAND_NAME = 'SciNovaTech';
const BRAND_TAGLINE = 'Learn Science. Earn Daily.';
const DEPOSIT_BANK = 'Safe Haven Microfinance Bank';
const DEPOSIT_ACCOUNT = '5012552807';
const DEPOSIT_NAME = 'PEERPURSER TECHNO';
const WELCOME_BONUS = 500;
const READING_REWARD = 100;
const TASKS_PER_DAY = 3;
const WITHDRAWAL_FEE_PCT = 13;
const MIN_DEPOSIT = 3000;
const MIN_WITHDRAWAL = 600;
const PAYOUT_CAP_MULTIPLIER = 3;
const APP_BASE_URL = 'https://scinova-tech.vercel.app';

// ============ DEFAULT PLANS ============
const DEFAULT_PLANS = {
    starter:   { name: 'Starter',   price: 3000,   dailyRate: 15, daysValid: 90, limitType: 'daily', dailyLimit: 1, status: 'active', order: 1 },
    bronze:    { name: 'Bronze',    price: 5000,   dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 1, status: 'active', order: 2 },
    silver:    { name: 'Silver',    price: 7500,   dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 1, status: 'active', order: 3 },
    gold:      { name: 'Gold',      price: 15000,  dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 2, status: 'active', order: 4 },
    platinum:  { name: 'Platinum',  price: 30000,  dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 2, status: 'active', order: 5 },
    diamond:   { name: 'Diamond',   price: 60000,  dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 2, status: 'active', order: 6 },
    elite:     { name: 'Elite',     price: 120000, dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 2, status: 'active', order: 7 },
    visionary: { name: 'Visionary', price: 200000, dailyRate: 15, daysValid: 90, limitType: 'total', totalLimit: 2, status: 'active', order: 8 }
};

const DEFAULT_CATEGORIES = [
    'Physics', 'Chemistry', 'Biology', 'Astronomy',
    'Artificial Intelligence', 'Robotics', 'Computing',
    'Engineering', 'Environment', 'Neuroscience'
];

// ============ CASE CONVERSION ============
function snakeToCamel(obj) {
    if (Array.isArray(obj)) return obj.map(snakeToCamel);
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
    const out = {};
    for (const k in obj) {
        const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        out[camel] = snakeToCamel(obj[k]);
    }
    return out;
}
function camelToSnake(obj) {
    if (Array.isArray(obj)) return obj.map(camelToSnake);
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
    const out = {};
    for (const k in obj) {
        const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
        out[snake] = camelToSnake(obj[k]);
    }
    return out;
}

// ============ BASIC HELPERS ============
function fmt(n) {
    return '₦' + Number(n || 0).toLocaleString();
}

function toast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) {
        existing.classList.add('fade-out');
        setTimeout(() => existing.remove(), 300);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
        t.classList.add('fade-out');
        setTimeout(() => t.remove(), 300);
    }, duration);
}

function generateRef(prefix = 'SCN') {
    return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-6);
}

function generateUserId() {
    return 'SCN-' + Date.now().toString(36).toUpperCase().slice(-8);
}

function getLocalDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
}

// ============ AUTH CHECK ============
// UPDATED: kicks suspended users out immediately
function checkAuth() {
    const userData = localStorage.getItem('scn_u');
    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['index.html', 'register.html', 'login.html', ''];
    if (!userData) {
        if (!publicPages.includes(currentPage)) window.location.href = 'login.html';
        return null;
    }
    try {
        const user = JSON.parse(userData);
        // NEW: if suspended, force logout
        if (user && user.status === 'suspended') {
            localStorage.removeItem('scn_u');
            window.location.href = 'login.html?reason=suspended';
            return null;
        }
        return user;
    } catch (e) {
        localStorage.removeItem('scn_u');
        if (!publicPages.includes(currentPage)) window.location.href = 'login.html';
        return null;
    }
}

function getCurrentUser() {
    const userData = localStorage.getItem('scn_u');
    if (!userData) return null;
    try { return JSON.parse(userData); } catch (e) { return null; }
}

// UPDATED: refreshes from DB, kicks suspended users, respects permissions
async function refreshUser() {
    const user = getCurrentUser();
    if (!user || !user.id) return null;
    try {
        const { data, error } = await _supabase
            .from('users').select('*').eq('id', user.id).maybeSingle();
        if (error) throw error;
        if (data) {
            const updated = { id: data.id, ...snakeToCamel(data) };
            // NEW: kick suspended users
            if (updated.status === 'suspended') {
                localStorage.removeItem('scn_u');
                window.location.href = 'login.html?reason=suspended';
                return null;
            }
            localStorage.setItem('scn_u', JSON.stringify(updated));
            return updated;
        }
        return user;
    } catch (error) {
        console.error('Refresh user error:', error);
        return user;
    }
}

// ============ FEATURE TOGGLES (NEW) ============
// Each returns true/false depending on both global toggle + per-user flag.

async function canUserDeposit(user) {
    if (!user) return false;
    const s = await getSiteSettings();
    if (s.depositsEnabled === false) return false;
    if (user.canDeposit === false) return false;
    if (user.status === 'suspended') return false;
    return true;
}

async function canUserWithdraw(user) {
    if (!user) return false;
    const s = await getSiteSettings();
    if (s.withdrawalsEnabled === false) return false;
    if (user.canWithdraw === false) return false;
    if (user.status === 'suspended') return false;
    return true;
}

async function canUserTask(user) {
    if (!user) return false;
    const s = await getSiteSettings();
    if (s.tasksEnabled === false) return false;
    if (user.canTask === false) return false;
    if (user.status === 'suspended') return false;
    if (s.emergencyStop === true) return false;
    return true;
}

// ============ PLAN HELPERS ============
function hasActivePlan(user) {
    if (!user) return false;
    if (!user.ownedPlans || user.ownedPlans.length === 0) return false;
    if (user.expiryDate) return new Date(user.expiryDate) > new Date();
    return true;
}

async function getAllPlans() {
    const cached = cacheGet('plans');
    if (cached) return cached;

    try {
        const { data, error } = await _supabase
            .from('settings').select('value').eq('key', 'plans').maybeSingle();
        if (error) throw error;
        if (!data || !data.value || Object.keys(data.value).length === 0) {
            await _supabase.from('settings').upsert({ key: 'plans', value: DEFAULT_PLANS });
            cacheSet('plans', DEFAULT_PLANS);
            return DEFAULT_PLANS;
        }
        cacheSet('plans', data.value);
        return data.value;
    } catch (error) {
        console.error('getAllPlans error:', error);
        return DEFAULT_PLANS;
    }
}

async function getActivePlans() {
    const all = await getAllPlans();
    const active = {};
    Object.keys(all).forEach(key => {
        if (all[key].status === 'active') active[key] = all[key];
    });
    return Object.keys(active).length > 0 ? active : DEFAULT_PLANS;
}

async function ensurePlansExist() {
    const plans = await getAllPlans();
    return plans !== null;
}

// UPDATED: includes new toggle + broadcast defaults
async function getSiteSettings() {
    const cached = cacheGet('siteSettings');
    if (cached) return cached;

    try {
        const { data } = await _supabase
            .from('settings').select('value').eq('key', 'site').maybeSingle();

        const val = data?.value || {
            welcomeBonus: WELCOME_BONUS,
            checkinReward: READING_REWARD,
            checkinReadSeconds: 60,
            taskReadSeconds: 10,
            tasksPerDay: TASKS_PER_DAY,
            starterDailyLimit: 20,
            withdrawalFeePct: WITHDRAWAL_FEE_PCT,
            minWithdrawal: MIN_WITHDRAWAL,
            minDeposit: MIN_DEPOSIT,
            payoutCapMultiplier: PAYOUT_CAP_MULTIPLIER,
            emergencyStop: false,
            ref1: 10,
            ref2: 3,
            ref3: 1,
            // NEW:
            depositsEnabled: true,
            withdrawalsEnabled: true,
            tasksEnabled: true,
            broadcastMessage: '',
            broadcastExpiry: 0
        };

        cacheSet('siteSettings', val);
        return val;
    } catch (e) {
        console.error('getSiteSettings error:', e);
        return {};
    }
}

async function getCategories() {
    try {
        const { data } = await _supabase
            .from('settings').select('value').eq('key', 'categories').maybeSingle();
        return data?.value || DEFAULT_CATEGORIES;
    } catch (e) {
        return DEFAULT_CATEGORIES;
    }
}

function calcTaskReward(planPrice, dailyRate = 15, tasksPerDay = TASKS_PER_DAY) {
    const daily = Number(planPrice) * (Number(dailyRate) / 100);
    return Math.floor(daily / tasksPerDay);
}

function calcDailyEarning(planPrice, dailyRate = 15) {
    return Math.floor(Number(planPrice) * (Number(dailyRate) / 100));
}

function calcTotalDailyEarning(user, plans) {
    if (!user || !user.ownedPlans || !plans) return 0;
    const planCounts = {};
    (user.ownedPlans || []).forEach(p => { planCounts[p] = (planCounts[p] || 0) + 1; });
    let total = 0;
    Object.keys(planCounts).forEach(key => {
        if (plans[key]) {
            total += calcDailyEarning(plans[key].price, plans[key].dailyRate || 15) * planCounts[key];
        }
    });
    return total;
}

function calculatePerQuestion(user, plans) {
    if (!user || !user.ownedPlans || !plans) return 0;
    const planCounts = {};
    (user.ownedPlans || []).forEach(p => { planCounts[p] = (planCounts[p] || 0) + 1; });
    let total = 0;
    Object.keys(planCounts).forEach(key => {
        if (plans[key]) {
            const perTask = calcTaskReward(plans[key].price, plans[key].dailyRate || 15);
            total += perTask * planCounts[key];
        }
    });
    return total;
}

// ============ TASK HELPERS ============
async function saveUserTasks(userId, date, tasks, checkinClaimed = false) {
    try {
        const completedCount = tasks.filter(t => t.done).length;
        const totalEarned = tasks.reduce((sum, t) => sum + (t.earned || 0), 0);
        const { error } = await _supabase.from('user_tasks').upsert({
            user_id: userId,
            date: date,
            tasks: tasks,
            completed_count: completedCount,
            total_earned: totalEarned,
            reading_reward_claimed: checkinClaimed,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,date' });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Save tasks error:', error);
        return false;
    }
}

async function syncUserTasks(userId, date) {
    try {
        const { data, error } = await _supabase
            .from('user_tasks').select('*')
            .eq('user_id', userId).eq('date', date).maybeSingle();
        if (error) throw error;
        if (data) {
            return {
                tasks: data.tasks || [],
                readingRewardClaimed: data.reading_reward_claimed || false
            };
        }
        return { tasks: [], readingRewardClaimed: false };
    } catch (error) {
        console.error('Sync tasks error:', error);
        return { tasks: [], readingRewardClaimed: false };
    }
}

async function getAllUserTasksForDate(date) {
    try {
        const { data, error } = await _supabase
            .from('user_tasks').select('*').eq('date', date);
        if (error) throw error;
        return (data || []).map(r => snakeToCamel(r));
    } catch (error) {
        console.error('Get all user tasks error:', error);
        return [];
    }
}

// ============ DAILY SLOTS ============
async function getStarterSlots() {
    try {
        const { data, error } = await _supabase.rpc('get_starter_slots');
        if (error) throw error;
        return data || { date: getLocalDate(), used: 0, limit: 20, remaining: 20 };
    } catch (e) {
        console.error('getStarterSlots error:', e);
        return { date: getLocalDate(), used: 0, limit: 20, remaining: 20 };
    }
}

async function claimStarterSlot() {
    try {
        const { data, error } = await _supabase.rpc('claim_starter_slot');
        if (error) throw error;
        return data || { ok: false, message: 'Could not claim slot' };
    } catch (e) {
        console.error('claimStarterSlot error:', e);
        return { ok: false, message: e.message || 'Error' };
    }
}

// ============ WITHDRAWAL HELPERS ============
async function canWithdrawToday(userId) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await _supabase
            .from('withdrawals').select('id')
            .eq('user_id', userId).gte('date', todayStr);
        if (error) throw error;
        const todayCount = (data || []).length;

        const { data: settingsRow } = await _supabase
            .from('settings').select('value').eq('key', 'withdrawalSettings').maybeSingle();
        const settings = settingsRow?.value || {};
        const day = new Date().getDay();
        const maxPerDay = (day === 0 || day === 6)
            ? (settings.max_weekend || 2) : (settings.max_weekday || 1);
        return todayCount < maxPerDay;
    } catch (error) {
        console.error('Can withdraw today error:', error);
        return false;
    }
}

async function isWithdrawalWindowOpen() {
    try {
        const { data } = await _supabase
            .from('settings').select('value').eq('key', 'withdrawalSettings').maybeSingle();
        const settings = data?.value || {};
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const startTime = settings.start_time
            ? parseInt(settings.start_time.split(':')[0]) * 60 + parseInt(settings.start_time.split(':')[1])
            : 480;
        const endTime = settings.end_time
            ? parseInt(settings.end_time.split(':')[0]) * 60 + parseInt(settings.end_time.split(':')[1])
            : 1320;
        return currentTime >= startTime && currentTime < endTime;
    } catch (error) {
        console.error('Withdrawal window check error:', error);
        return false;
    }
}

// ============ GENERIC DOC HELPERS ============
async function getDoc(collection, docId) {
    try {
        let query = _supabase.from(collection).select('*');
        query = (collection === 'settings') ? query.eq('key', docId) : query.eq('id', docId);
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        if (collection === 'settings') return { key: data.key, ...(data.value || {}) };
        return { id: data.id, ...snakeToCamel(data) };
    } catch (error) {
        console.error('getDoc error:', error);
        return null;
    }
}

async function setDoc(collection, docId, data) {
    try {
        if (collection === 'settings') {
            await _supabase.from(collection).upsert({
                key: docId, value: data, updated_at: new Date().toISOString()
            });
        } else {
            const payload = { ...camelToSnake(data), id: docId, updated_at: new Date().toISOString() };
            await _supabase.from(collection).upsert(payload, { onConflict: 'id' });
        }
    } catch (error) {
        console.error('setDoc error:', error);
        throw error;
    }
}

async function updateDoc(collection, docId, data) {
    try {
        if (collection === 'settings') {
            const existing = await getDoc('settings', docId);
            const merged = { ...(existing || {}), ...data };
            delete merged.key;
            await _supabase.from(collection).upsert({
                key: docId, value: merged, updated_at: new Date().toISOString()
            });
        } else {
            const payload = { ...camelToSnake(data), updated_at: new Date().toISOString() };
            const { error } = await _supabase.from(collection).update(payload).eq('id', docId);
            if (error) throw error;
        }
    } catch (error) {
        console.error('updateDoc error:', error);
        throw error;
    }
}

async function getCollection(collectionName) {
    try {
        const { data, error } = await _supabase.from(collectionName).select('*');
        if (error) throw error;
        return (data || []).map(r => {
            if (collectionName === 'settings') return { key: r.key, ...(r.value || {}) };
            return { id: r.id, ...snakeToCamel(r) };
        });
    } catch (error) {
        console.error('getCollection error:', error);
        return [];
    }
}

async function deleteDoc(collection, docId) {
    try {
        const { error } = (collection === 'settings')
            ? await _supabase.from(collection).delete().eq('key', docId)
            : await _supabase.from(collection).delete().eq('id', docId);
        if (error) throw error;
    } catch (error) {
        console.error('deleteDoc error:', error);
        throw error;
    }
}

async function addDoc(collection, data) {
    try {
        const payload = camelToSnake(data);
        const { data: inserted, error } = await _supabase
            .from(collection).insert(payload).select().single();
        if (error) throw error;
        return { id: inserted.id, ...snakeToCamel(inserted) };
    } catch (error) {
        console.error('addDoc error:', error);
        throw error;
    }
}

async function incrementUserField(userId, field, amount) {
    const snakeField = field.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    const { error } = await _supabase.rpc('increment_user_field', {
        p_user_id: userId, p_field: snakeField, p_amount: amount
    });
    if (error) console.error('incrementUserField error:', error);
}

// ============ EMAIL ============
async function sendAdminEmail(subject, message) {
    try {
        const formData = new FormData();
        formData.append('email', ADMIN_EMAIL);
        formData.append('_subject', subject);
        formData.append('_template', 'box');
        formData.append('message', message);
        await fetch('https://formsubmit.co/ajax/' + ADMIN_EMAIL, {
            method: 'POST', body: formData
        });
        return true;
    } catch (e) {
        console.error('Email send error:', e);
        return false;
    }
}

// ============ ANIMATIONS ============
function animateCountUp(element, target, duration = 800) {
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = fmt(Math.floor(target * eased));
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function staggerCards(selector, baseDelay = 0.05) {
    document.querySelectorAll(selector).forEach((card, i) => {
        card.style.animationDelay = (i * baseDelay) + 's';
        card.style.opacity = '1';
    });
}

// ============================================================
// EXPOSE GLOBALLY
// ============================================================
window.sb = _supabase;
window.cacheSet = cacheSet;
window.cacheGet = cacheGet;
window.cacheClear = cacheClear;

window.fmt = fmt;
window.toast = toast;
window.generateRef = generateRef;
window.generateUserId = generateUserId;
window.getLocalDate = getLocalDate;
window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.refreshUser = refreshUser;

// NEW toggles
window.canUserDeposit = canUserDeposit;
window.canUserWithdraw = canUserWithdraw;
window.canUserTask = canUserTask;

window.hasActivePlan = hasActivePlan;
window.getActivePlans = getActivePlans;
window.getAllPlans = getAllPlans;
window.ensurePlansExist = ensurePlansExist;
window.getSiteSettings = getSiteSettings;
window.getCategories = getCategories;
window.calcTaskReward = calcTaskReward;
window.calcDailyEarning = calcDailyEarning;
window.calcTotalDailyEarning = calcTotalDailyEarning;
window.calculatePerQuestion = calculatePerQuestion;
window.canWithdrawToday = canWithdrawToday;
window.isWithdrawalWindowOpen = isWithdrawalWindowOpen;
window.getDoc = getDoc;
window.setDoc = setDoc;
window.updateDoc = updateDoc;
window.getCollection = getCollection;
window.deleteDoc = deleteDoc;
window.addDoc = addDoc;
window.incrementUserField = incrementUserField;
window.sendAdminEmail = sendAdminEmail;
window.animateCountUp = animateCountUp;
window.staggerCards = staggerCards;

window.saveUserTasks = saveUserTasks;
window.syncUserTasks = syncUserTasks;
window.getAllUserTasksForDate = getAllUserTasksForDate;

window.getStarterSlots = getStarterSlots;
window.claimStarterSlot = claimStarterSlot;

window.DEFAULT_PLANS = DEFAULT_PLANS;
window.DEFAULT_CATEGORIES = DEFAULT_CATEGORIES;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.BRAND_NAME = BRAND_NAME;
window.BRAND_TAGLINE = BRAND_TAGLINE;
window.DEPOSIT_BANK = DEPOSIT_BANK;
window.DEPOSIT_ACCOUNT = DEPOSIT_ACCOUNT;
window.DEPOSIT_NAME = DEPOSIT_NAME;
window.WELCOME_BONUS = WELCOME_BONUS;
window.READING_REWARD = READING_REWARD;
window.TASKS_PER_DAY = TASKS_PER_DAY;
window.WITHDRAWAL_FEE_PCT = WITHDRAWAL_FEE_PCT;
window.MIN_DEPOSIT = MIN_DEPOSIT;
window.MIN_WITHDRAWAL = MIN_WITHDRAWAL;
window.PAYOUT_CAP_MULTIPLIER = PAYOUT_CAP_MULTIPLIER;
window.APP_BASE_URL = APP_BASE_URL;

console.log('🌱 SciNovaTech Supabase client ready');
