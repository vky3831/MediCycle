// ---------- Data model and localStorage helpers ----------
const STORAGE_KEY = 'medicycle_data_v1';
const VERIFIED_KEY = 'medicycle_verified_profile'; // ADDED

function defaultData(){
  return {
    profiles: [],
    history: [],
    currentProfileId: null
  };
}

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    return JSON.parse(raw);
  }catch(e){ console.error('loadData', e); return defaultData(); }
}

function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function uid(prefix='id'){
  return prefix + '_' + Math.random().toString(36).slice(2,9);
}

// Passkey verification persistence
function setVerifiedProfile(id){ localStorage.setItem(VERIFIED_KEY, id); }
function getVerifiedProfile(){ return localStorage.getItem(VERIFIED_KEY); }
function clearVerified(){ localStorage.removeItem(VERIFIED_KEY); }

// ---------- DOM refs ----------
const screenProfile = document.getElementById('screen-profile');
const screenApp = document.getElementById('screen-app');
const screenAdd = document.getElementById('screen-add');

const createProfileBtn = document.getElementById('createProfileBtn');
const addProfileBtn = document.getElementById('addProfileBtn');
const profilesList = document.getElementById('profilesList');

const profileTitle = document.getElementById('profileTitle');
const profileAgeEl = document.getElementById('profileAge');
const profileIdEl = document.getElementById('profileId');

const switchProfileBtn = document.getElementById('switchProfileBtn');
const logoutBtn = document.getElementById('logoutBtn'); // ADDED
const deleteProfileBtn = document.getElementById('deleteProfileBtn');

const addMedicineBtn = document.getElementById('addMedicineBtn');
const medListAll = document.getElementById('medListAll');
const medListToday = document.getElementById('medListToday');
const historyList = document.getElementById('historyList');

const medForm = document.getElementById('medForm');
const medName = document.getElementById('medName');
const medDosage = document.getElementById('medDosage');
const medTime = document.getElementById('medTime');
const medCycle = document.getElementById('medCycle');
const cycleDetails = document.getElementById('cycleDetails');
const saveMedBtn = document.getElementById('saveMedBtn');
const cancelMedBtn = document.getElementById('cancelMedBtn');
const addTitle = document.getElementById('addTitle');

const toggleTheme = document.getElementById('toggleTheme');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');

// Tabs
document.querySelectorAll('#mainTabs .nav-link').forEach(a => {
  a.addEventListener('click', ()=>{
    document.querySelectorAll('#mainTabs .nav-link').forEach(x=>x.classList.remove('active'));
    a.classList.add('active');

    document.querySelectorAll('.tab-pane').forEach(p=>p.style.display='none');
    document.getElementById('tab-'+a.dataset.tab).style.display='block';

    if(a.dataset.tab === 'history') renderHistory();
    if(a.dataset.tab === 'today') renderToday();
    if(a.dataset.tab === 'all') renderAll();
  });
});

// ---------- Profile creation / selection UI ----------
function showCreateProfileForm(){
  const name = prompt('Name:'); if(!name) return;
  const age = prompt('Age:'); if(!age) return;
  const passkey = prompt('Passkey:'); if(!passkey) return;

  const data = loadData();
  const id = uid('profile');
  data.profiles.push({ id, name, age, passkey, medicines: [] });
  data.currentProfileId = id;
  saveData(data);

  setVerifiedProfile(id); // mark as verified

  initApp();
}

function renderProfiles(){
  const data = loadData();
  profilesList.innerHTML = '';

  if(data.profiles.length===0){
    document.getElementById('no-data-screen').style.display='block';
    document.getElementById('select-profile-screen').style.display='none';
    return;
  }

  document.getElementById('no-data-screen').style.display='none';
  document.getElementById('select-profile-screen').style.display='block';

  data.profiles.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'd-flex align-items-center justify-content-between mb-2 card p-2';

    div.innerHTML = `
      <div><strong>${p.name}</strong>
        <div class="small-muted">Age ${p.age}</div>
      </div>
      <div>
        <button class="btn btn-sm btn-primary select-profile" data-id="${p.id}">Open</button>
        <button class="btn btn-sm btn-outline-danger ms-1 delete-profile" data-id="${p.id}">Delete</button>
      </div>
    `;

    profilesList.appendChild(div);
  });

  // SELECT PROFILE — passkey only here
  document.querySelectorAll('.select-profile').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      const data = loadData();
      const profile = data.profiles.find(x=>x.id===id);
      if(!profile) return;

      if(getVerifiedProfile() !== id){
        const pass = prompt(`Passkey for "${profile.name}":`);
        if(pass !== profile.passkey){
          alert("Wrong passkey");
          return;
        }
        setVerifiedProfile(id);
      }

      data.currentProfileId = id;
      saveData(data);
      initApp();
    });
  });

  // DELETE PROFILE
  document.querySelectorAll('.delete-profile').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.id;
      const data = loadData();
      const profile = data.profiles.find(x=>x.id===id);

      if(confirm(`Delete profile "${profile.name}"?`)){
        data.profiles = data.profiles.filter(p=>p.id!==id);
        data.history = data.history.filter(h=>h.profileId!==id);

        if(data.currentProfileId===id) data.currentProfileId = null;
        if(getVerifiedProfile()===id) clearVerified();

        saveData(data);
        initApp();
      }
    });
  });
}
// ---------- App init / rendering ----------
let data = loadData();
let currentProfile = null;
let editingMedId = null;

function initApp(){
  data = loadData();

  // FIX: ALWAYS show profile list if no logged-in user
  if(!data.currentProfileId){
    screenProfile.style.display='block';
    screenApp.style.display='none';
    screenAdd.style.display='none';
    renderProfiles(); // <-- IMPORTANT FIX
    return;
  }

  // If logged-in profile exists → open directly (no passkey)
  const profile = data.profiles.find(p=> p.id === data.currentProfileId);
  if(profile){
    currentProfile = profile;
    openAppForProfile();
    return;
  }

  // If stored profile id invalid, reset & show list
  data.currentProfileId = null;
  saveData(data);
  screenProfile.style.display='block';
  screenApp.style.display='none';
  screenAdd.style.display='none';
  renderProfiles();
}

function openAppForProfile(){
  screenProfile.style.display='none';
  screenApp.style.display='block';
  screenAdd.style.display='none';

  profileTitle.textContent = currentProfile.name;
  profileAgeEl.textContent = currentProfile.age;
  profileIdEl.textContent = currentProfile.id;

  renderAll();
  renderToday();
}

// ---------- Rendering ----------
function renderAll(){
  medListAll.innerHTML = '';
  if(!currentProfile || currentProfile.medicines.length===0){
    medListAll.innerHTML = '<div class="text-muted">No medicines added yet</div>';
    return;
  }

  currentProfile.medicines.forEach(m=>{
    const card = document.createElement('div');
    card.className='card p-2 mb-2';
    card.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <div class="h6 mb-0">${m.name}</div>
          <div class="small-muted">${m.dosage} • ${m.food==='after'?'After Food':'Before Food'}</div>
          <div class="small-muted">Time: ${m.time} • Cycle: ${cycleLabel(m)}</div>
        </div>
        <div class="text-end">
          <button class="btn btn-sm btn-outline-primary edit-med" data-id="${m.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger ms-1 del-med" data-id="${m.id}">Delete</button>
        </div>
      </div>`;
    medListAll.appendChild(card);
  });

  document.querySelectorAll('.edit-med').forEach(b=> b.addEventListener('click', ()=> openEditMedicine(b.dataset.id)));
  document.querySelectorAll('.del-med').forEach(b=> b.addEventListener('click', ()=> deleteMed(b.dataset.id)));
}

function renderToday(){
  medListToday.innerHTML = '';
  if(!currentProfile) return;

  const today = new Date();
  const todays = currentProfile.medicines.filter(m=> isMedicineForDate(m, today));

  if(todays.length===0){
    medListToday.innerHTML = '<div class="text-muted">No medicines scheduled for today</div>';
    return;
  }

  todays.forEach(m=>{
    const taken = wasTakenToday(currentProfile.id, m.id);

    const div = document.createElement('div');
    div.className='card p-2 mb-2 d-flex justify-content-between align-items-center';
    div.innerHTML = `
      <div>
        <div class="h6 mb-0">${m.name} ${taken? '<span class="badge bg-success ms-2">Taken</span>':''}</div>
        <div class="small-muted">${m.dosage} • ${m.time} • ${m.food==='after'?'After Food':'Before Food'}</div>
      </div>
      <button class="btn btn-sm btn-success mark-taken" data-id="${m.id}" ${taken?'disabled':''}>Mark taken</button>`;

    medListToday.appendChild(div);
  });

  document.querySelectorAll('.mark-taken').forEach(b=> b.addEventListener('click', ()=> markTaken(b.dataset.id)));
}

function renderHistory(){
  historyList.innerHTML = '';
  const data = loadData();

  const list = data.history
    .filter(h=> h.profileId === currentProfile.id)
    .sort((a,b)=> new Date(b.timeTakenISO)-new Date(a.timeTakenISO));

  if(list.length===0){
    historyList.innerHTML = '<div class="text-muted">No history yet</div>';
    return;
  }

  list.forEach(h=>{
    const el = document.createElement('div');
    el.className='card p-2 mb-2';
    el.innerHTML = `
      <div class="d-flex justify-content-between">
        <div>
          <strong>${h.medName}</strong>
          <div class="small-muted">${h.dosage} • ${new Date(h.timeTakenISO).toLocaleString()}</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary btn-copy" data-iso="${h.timeTakenISO}">Copy time</button>
      </div>`;
    historyList.appendChild(el);
  });

  document.querySelectorAll('.btn-copy')
    .forEach(b=> b.addEventListener('click', ()=> navigator.clipboard.writeText(b.dataset.iso)));
}

// ---------- Helpers ----------
function cycleLabel(m){
  if(m.cycle==='daily') return 'Daily';
  if(m.cycle==='monthly') return 'Monthly on '+ m.monthDay;
  if(m.cycle==='weekly') return 'Weekly on '+ (m.weekDays? m.weekDays.join(', '):'?');
  return '';
}

function isMedicineForDate(m, date){
  if(m.cycle==='daily') return true;

  if(m.cycle==='monthly'){
    return Number(m.monthDay) === date.getDate();
  }

  if(m.cycle==='weekly'){
    const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return m.weekDays && m.weekDays.includes(names[date.getDay()]);
  }

  return false;
}

function wasTakenToday(profileId, medId){
  const d = loadData();
  const today = (new Date()).toDateString();
  return d.history.some(h=> 
    h.profileId===profileId &&
    h.medId===medId &&
    new Date(h.timeTakenISO).toDateString()===today
  );
}
// ---------- Add/Edit/Delete medicine ----------
function openAddMedicine(){
  editingMedId = null;
  addTitle.textContent = 'Add Medicine';

  medForm.reset();
  cycleDetails.innerHTML='';
  medCycle.value='daily';
  renderCycleDetails();

  screenProfile.style.display='none';
  screenApp.style.display='none';
  screenAdd.style.display='block';
}

function openEditMedicine(id){
  const med = currentProfile.medicines.find(x=> x.id===id);
  if(!med) return;

  editingMedId = id;
  addTitle.textContent = 'Edit Medicine';

  medName.value = med.name;
  medDosage.value = med.dosage;
  medTime.value = med.time;
  document.querySelectorAll('input[name="food"]').forEach(r=> r.checked = (r.value === med.food));
  medCycle.value = med.cycle;

  renderCycleDetails(med);

  screenProfile.style.display='none';
  screenApp.style.display='none';
  screenAdd.style.display='block';
}

function deleteMed(id){
  if(!confirm('Delete this medicine?')) return;

  const data = loadData();
  const profile = data.profiles.find(p=> p.id===data.currentProfileId);
  profile.medicines = profile.medicines.filter(m=> m.id!==id);

  saveData(data);
  initApp();
}

medCycle.addEventListener('change', ()=> renderCycleDetails());

function renderCycleDetails(med=null){
  const v = medCycle.value;

  if(v==='daily'){
    cycleDetails.innerHTML = '<div class="form-text">Will repeat every day</div>';
    return;
  }

  if(v==='monthly'){
    const val = med? (med.monthDay||'') : '';
    cycleDetails.innerHTML = `
      <label class="form-label">Date of month (1-31)</label>
      <input id="monthDay" type="number" min="1" max="31" class="form-control" value="${val}" required>`;
    return;
  }

  if(v==='weekly'){
    const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const selected = med && med.weekDays ? med.weekDays : [];

    cycleDetails.innerHTML = `
      <label class="form-label d-block">Select weekdays</label>
      ${names.map(n=> `
        <div class='form-check form-check-inline'>
          <input class='form-check-input week-day' type='checkbox' value='${n}' ${selected.includes(n)?'checked':''}>
          <label class='form-check-label'>${n.slice(0,3)}</label>
        </div>`).join('')}
    `;
  }
}

medForm.addEventListener('submit', e=>{
  e.preventDefault();
  saveMedicine();
});

cancelMedBtn.addEventListener('click', ()=>{
  screenAdd.style.display='none';
  screenApp.style.display='block';
});

function saveMedicine(){
  const name = medName.value.trim();
  const dosage = medDosage.value.trim();
  const time = medTime.value;
  const food = document.querySelector('input[name="food"]:checked').value;
  const cycle = medCycle.value;

  const data = loadData();
  const profile = data.profiles.find(p=> p.id===data.currentProfileId);

  let medObj = editingMedId ? profile.medicines.find(m=> m.id===editingMedId) : null;

  if(!medObj){
    medObj = { id: uid('med'), name, dosage, time, food, cycle };
    profile.medicines.push(medObj);
  } else {
    medObj.name = name;
    medObj.dosage = dosage;
    medObj.time = time;
    medObj.food = food;
    medObj.cycle = cycle;
  }

  if(cycle==='monthly'){
    medObj.monthDay = Number(document.getElementById('monthDay').value);
  }
  if(cycle==='weekly'){
    medObj.weekDays = Array.from(document.querySelectorAll('.week-day:checked')).map(x=>x.value);
  }

  saveData(data);
  initApp();
}

// ---------- Mark taken ----------
function markTaken(medId){
  const data = loadData();
  const profile = data.profiles.find(p=> p.id===data.currentProfileId);
  const med = profile.medicines.find(m=> m.id===medId);

  data.history.push({
    profileId: profile.id,
    medId: med.id,
    medName: med.name,
    dosage: med.dosage,
    timeTakenISO: new Date().toISOString()
  });

  saveData(data);
  renderToday();
}

// ---------- Export / Import ----------
exportBtn.addEventListener('click', ()=>{
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'medicycle_data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;

  try{
    const txt = await f.text();
    const imported = JSON.parse(txt);

    if(!imported.profiles) throw new Error('Invalid file');

    if(confirm('This will replace current data. Proceed?')){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
      clearVerified(); // reset passkey state
      alert('Imported. Reloading view.');
      initApp();
    }

  }catch(err){
    alert('Failed to import: '+err.message);
  }

  importFile.value='';
});

// ---------- Notifications ----------
let notifiedSet = new Set();

function requestNotifPermission(){
  if('Notification' in window)
    Notification.requestPermission();
}

function checkReminders(){
  const now = new Date();
  const hhmm = now.toTimeString().slice(0,5);

  const data = loadData();
  if(!data.currentProfileId) return;

  const profile = data.profiles.find(p=> p.id===data.currentProfileId);
  if(!profile) return;

  profile.medicines.forEach(m=>{
    if(m.time===hhmm && isMedicineForDate(m, now)){
      const key = `${profile.id}|${m.id}|${now.toDateString()}|${hhmm}`;
      if(notifiedSet.has(key)) return;

      notifiedSet.add(key);

      if(Notification.permission==='granted'){
        new Notification(`MediCycle: ${m.name}`, {
          body: `${m.dosage} • ${m.food==='after'?'After Food':'Before Food'}`
        });
      }
    }
  });
}

setInterval(checkReminders, 20000);

// ---------- Theme ----------
function applyTheme(isDark){
  if(isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  localStorage.setItem('medicycle_theme', isDark? 'dark':'light');
}

toggleTheme.addEventListener('click', ()=>{
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('medicycle_theme', isDark? 'dark':'light');
});

(function(){
  const t = localStorage.getItem('medicycle_theme');
  applyTheme(t==='dark');
})();

// ---------- Buttons wiring ----------
createProfileBtn.addEventListener('click', showCreateProfileForm);
addProfileBtn.addEventListener('click', showCreateProfileForm);

// SWITCH PROFILE — full reset to list
switchProfileBtn.addEventListener('click', ()=>{
  const data = loadData();
  data.currentProfileId = null;
  saveData(data);
  clearVerified();
  currentProfile = null;
  initApp();
});

// LOGOUT FEATURE
logoutBtn.addEventListener('click', ()=>{
  const data = loadData();
  data.currentProfileId = null;
  saveData(data);
  clearVerified();
  currentProfile = null;
  initApp();
});

addMedicineBtn.addEventListener('click', openAddMedicine);

// DELETE PROFILE
deleteProfileBtn.addEventListener('click', ()=>{
  if(!currentProfile) return;

  if(confirm(`Delete current profile "${currentProfile.name}"?`)){
    const data = loadData();

    data.profiles = data.profiles.filter(p=> p.id!==currentProfile.id);
    data.history = data.history.filter(h=> h.profileId!==currentProfile.id);

    data.currentProfileId = null;
    saveData(data);

    clearVerified();
    currentProfile = null;

    initApp();
  }
});

// Notification permission on first click
document.addEventListener('click', ()=>{
  if(Notification && Notification.permission==='default')
    requestNotifPermission();
}, {once:true});

// Initialize
initApp();
