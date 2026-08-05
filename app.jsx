const { useState, useEffect, createContext, useContext, useRef } = React;

// Helper Functions
const generateId = () => Math.random().toString(36).substr(2, 9);
const generateTripCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const formatCurrency = (val) => {
  if (!val && val !== 0) return '';
  const num = val.toString().replace(/[^0-9]/g, '');
  return num ? parseInt(num, 10).toLocaleString('en-US') : '';
};
const parseCurrency = (val) => {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
};
const compressImage = (file, maxWidth = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};
// Toast Component
const ToastNotification = () => {
  const { toastMessage } = useTrip();

  if (!toastMessage) return null;

  return (
    <div className="position-fixed top-0 end-0 p-4 mt-5" style={{ zIndex: 99999, transition: 'all 0.3s ease-in-out', pointerEvents: 'none' }}>
      <div className={`alert alert-${toastMessage.type} shadow-lg d-flex align-items-center gap-3 m-0`} style={{ minWidth: '300px', borderRadius: '12px', borderLeft: `6px solid var(--bs-${toastMessage.type})` }}>
        <Icon name={toastMessage.type === 'success' ? 'check-circle' : 'alert-circle'} size={24} />
        <span className="fw-medium fs-6">{toastMessage.message}</span>
      </div>
    </div>
  );
};

// Context
const TripContext = createContext();
const useTrip = () => useContext(TripContext);

const TripProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('tripUser') || null);
  const [trips, setTrips] = useState([]);
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [globalFriends, setGlobalFriends] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('my-trips');
  const [activeTripId, setActiveTripId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('tripDarkMode') === 'true');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('tripThemeColor') || '#0ea5e9');
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('tripBgColor') || '');
  const [toastMessage, setToastMessage] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000); // 4 seconds duration
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useEffect(() => {
    // Apply primary color directly to root CSS variables
    const root = document.documentElement;
    root.style.setProperty('--primary', themeColor);
    root.style.setProperty('--bs-primary', themeColor); // Bootstrap override
    
    // Calculate simple dark and light shades using color-mix (modern browser feature)
    root.style.setProperty('--primary-dark', `color-mix(in srgb, ${themeColor}, black 20%)`);
    root.style.setProperty('--primary-light', `color-mix(in srgb, ${themeColor}, white 20%)`);
    root.style.setProperty('--primary-subtle', `color-mix(in srgb, ${themeColor}, white 85%)`);
    
    
    localStorage.setItem('tripThemeColor', themeColor);
  }, [themeColor]);

  const generateThemeFromBg = (bgHex) => {
    if (!bgHex) return {};
    let hex = bgHex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 2), 16);
    const b = parseInt(hex.substring(4, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    const isLight = yiq >= 128;

    const adjust = (amount) => {
      let rNew = Math.max(0, Math.min(255, r + amount));
      let gNew = Math.max(0, Math.min(255, g + amount));
      let bNew = Math.max(0, Math.min(255, b + amount));
      return `#${rNew.toString(16).padStart(2, '0')}${gNew.toString(16).padStart(2, '0')}${bNew.toString(16).padStart(2, '0')}`;
    };

    const textPrimary = isLight ? '#1e293b' : '#f8fafc';
    const textSecondary = isLight ? '#475569' : '#cbd5e1';
    const textMuted = isLight ? '#64748b' : '#94a3b8';

    let bgCard;
    if (isLight) {
        if (yiq > 230) bgCard = '#ffffff';
        else bgCard = adjust(30);
    } else {
        bgCard = adjust(35);
    }
    
    let bgInput = isLight ? '#ffffff' : adjust(45);
    let border = isLight ? adjust(-30) : adjust(50);

    return {
      '--bg-body': bgHex,
      '--bg-card': bgCard,
      '--bg-sidebar': bgCard,
      '--bg-input': bgInput,
      '--text-primary': textPrimary,
      '--text-secondary': textSecondary,
      '--text-muted': textMuted,
      '--border': border,
      '--gray-50': bgHex,
      '--gray-100': bgCard,
      '--gray-200': border,
      '--bs-body-bg': bgHex,
      '--bs-body-color': textPrimary,
      '--bs-secondary-color': textMuted
    };
  };

  useEffect(() => {
    const body = document.body;
    let styleTag = document.getElementById('trip-dynamic-theme');
    
    if (bgColor) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'trip-dynamic-theme';
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        body { background-color: var(--bg-body) !important; color: var(--text-primary) !important; }
        .sidebar, .bg-white, .bg-light, .card, .settings-layout, .card-trip, .module-card, .auth-card {
          background-color: var(--bg-card) !important; border-color: var(--border) !important; color: var(--text-primary) !important;
        }
        .form-control, .form-select { background-color: var(--bg-input) !important; border-color: var(--border) !important; color: var(--text-primary) !important; }
        .text-muted { color: var(--text-muted) !important; }
        .text-secondary { color: var(--text-secondary) !important; }
        .text-dark { color: var(--text-primary) !important; }
      `;

      const themeVars = generateThemeFromBg(bgColor);
      Object.entries(themeVars).forEach(([key, value]) => {
        body.style.setProperty(key, value);
      });
      
      localStorage.setItem('tripBgColor', bgColor);
      if (themeColor !== bgColor) setThemeColor(bgColor);
    } else {
      if (styleTag) styleTag.remove();
      
      const varsToRemove = [
        '--bg-body', '--bg-card', '--bg-sidebar', '--bg-input', 
        '--text-primary', '--text-secondary', '--text-muted', '--border', 
        '--gray-50', '--gray-100', '--gray-200', '--bs-body-bg', 
        '--bs-body-color', '--bs-secondary-color'
      ];
      varsToRemove.forEach(key => body.style.removeProperty(key));
      localStorage.removeItem('tripBgColor');
    }
  }, [bgColor]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('tripDarkMode', newMode);
  };

  const fetchAPI = async (action, data = {}) => {
    try {
      const res = await fetch(`api/api.php?action=${action}${action === 'get_trips' || action === 'get_categories' || action === 'get_templates' || action === 'get_notifications' || action === 'get_unread_count' || action === 'get_profile' || action === 'find_trip_by_code' ? `&${Object.entries(data).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&')}` : ''}`, {
        method: action.includes('get') ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action.includes('get') ? undefined : JSON.stringify(data)
      });
      const text = await res.text();
      if (!text.startsWith('{')) return { success: false, message: 'Server error' };
      return JSON.parse(text);
    } catch (err) {
      return { success: false, message: 'Connection error' };
    }
  };

  const fetchTrips = async (user) => {
    setIsLoading(true);
    const data = await fetchAPI('get_trips', { owner: user });
    if (data.success) setTrips(data.trips || []);
    setIsLoading(false);
  };

  const fetchCategories = async (user) => {
    const data = await fetchAPI('get_categories', { owner: user });
    if (data.success) setCategories(data.categories || []);
  };

  const fetchTemplates = async (user) => {
    const data = await fetchAPI('get_templates', { owner: user });
    if (data.success) setTemplates(data.templates || []);
  };

  const fetchNotifications = async (user) => {
    const data = await fetchAPI('get_notifications', { user_id: user });
    if (data.success) setNotifications(data.notifications || []);
    const count = await fetchAPI('get_unread_count', { user_id: user });
    if (count.success) setUnreadCount(count.count || 0);
  };

  const fetchGlobalFriends = async (user) => {
    const data = await fetchAPI('get_global_friends', { user_id: user });
    if (data.success) setGlobalFriends(data.friends || []);
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('tripUser', currentUser);
      fetchTrips(currentUser);
      fetchCategories(currentUser);
      fetchTemplates(currentUser);
      fetchNotifications(currentUser);
      fetchGlobalFriends(currentUser);
    } else {
      localStorage.removeItem('tripUser');
      setTrips([]);
    }
  }, [currentUser]);

  const loginUser = async (username, password) => {
    const data = await fetchAPI('login', { username, password });
    if (data.success) setCurrentUser(username);
    return data;
  };

  const registerUser = async (username, password, email = '') => {
    const data = await fetchAPI('register', { username, password, email });
    if (data.success) setCurrentUser(username);
    return data;
  };

  const logout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    setActiveView('my-trips');
    setActiveTripId(null);
    setShowLogoutModal(false);
  };

  const activeTrip = trips.find(t => t.id === activeTripId) || null;

  const createTrip = async (name, budget, category_id = null, coverUrl = null) => {
    const trip = {
      id: generateId(), owner: currentUser, name,
      totalPlanBudget: parseCurrency(budget),
      tripCode: generateTripCode(), category_id,
      coverUrl: coverUrl,
      schedules: [], friends: []
    };
    setTrips([...trips, { ...trip, isOwner: true }]);
    fetchAPI('create_trip', trip);
    return { success: true };
  };

  const updateTrip = async (id, fields) => {
    setTrips(trips.map(t => t.id === id ? { ...t, ...fields } : t));
    fetchAPI('update_trip', { id, ...fields });
  };

  const deleteTrip = async (id) => {
    setTrips(trips.filter(t => t.id !== id));
    setActiveView('my-trips');
    setActiveTripId(null);
    fetchAPI('delete_trip', { id });
  };

  const addSchedule = async (schedule) => {
    const newSch = { ...schedule, id: generateId(), trip_id: activeTripId, photos: [], is_addon: schedule.is_addon || false };
    setTrips(trips.map(t => t.id === activeTripId ? { ...t, schedules: [...t.schedules, newSch] } : t));
    fetchAPI('add_schedule', newSch);
  };

  const updateSchedulePhotos = async (id, photos) => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t, schedules: t.schedules.map(s => s.id === id ? { ...s, photos } : s)
    } : t));
    fetchAPI('update_schedule_photos', { id, photos });
  };

  const updateSchedule = async (id, fields) => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t, schedules: t.schedules.map(s => s.id === id ? { ...s, ...fields } : s)
    } : t));
    
    if (fields.photos !== undefined) {
      fetchAPI('update_schedule_photos', { id, photos: fields.photos });
    }
    fetchAPI('update_schedule', { id, ...fields });
  };

  const deleteSchedule = async (id) => {
    setTrips(trips.map(t => t.id === activeTripId ? { ...t, schedules: t.schedules.filter(s => s.id !== id) } : t));
    fetchAPI('delete_schedule', { id });
  };

  const addFriend = async (name, email) => {
    const friend = { id: generateId(), trip_id: activeTripId, name, email };
    setTrips(trips.map(t => t.id === activeTripId ? { ...t, friends: [...t.friends, friend] } : t));
    fetchAPI('add_friend', friend);
  };

  const removeFriend = (id) => {
    setTrips(trips.map(t => t.id === activeTripId ? { ...t, friends: t.friends.filter(f => f.id !== id) } : t));
    fetchAPI('delete_friend', { id });
  };

  const searchUsers = async (query) => {
    if (!query) return [];
    const data = await fetchAPI('search_users', { query, user_id: currentUser });
    return data.success ? (data.users || []) : [];
  };

  const addGlobalFriend = async (friendUsername) => {
    const res = await fetchAPI('add_global_friend', { user_username: currentUser, friend_username: friendUsername });
    if (res.success) {
      await fetchGlobalFriends(currentUser);
    }
    return res;
  };

  const removeGlobalFriend = async (id) => {
    const res = await fetchAPI('remove_global_friend', { id });
    if (res.success) {
      setGlobalFriends(globalFriends.filter(f => f.relationship_id !== id));
    }
    return res;
  };

  const joinTrip = async (tripCode) => {
    const data = await fetchAPI('join_trip', { trip_code: tripCode, user: currentUser });
    if (data.success) await fetchTrips(currentUser);
    return data;
  };

  const exportTrip = async () => {
    const data = await fetchAPI('export_trip', { trip_id: activeTripId });
    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTrip?.name || 'trip'}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const importTrip = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const res = await fetchAPI('import_trip', { owner: currentUser, data });
        if (res.success) await fetchTrips(currentUser);
        alert(res.success ? 'Imported successfully!' : 'Failed: ' + res.message);
      } catch (err) { alert('Invalid file'); }
    };
    reader.readAsText(file);
  };

  const saveTemplate = async (name, description, template_data) => {
    const id = generateId();
    await fetchAPI('save_template', { id, owner: currentUser, name, description, template_data });
    setTemplates([{ id, name, description, created_at: new Date().toISOString() }, ...templates]);
  };

  const deleteTemplate = async (id) => {
    await fetchAPI('delete_template', { id });
    setTemplates(templates.filter(t => t.id !== id));
  };

  const useTemplate = async (template_id) => {
    const res = await fetchAPI('use_template', { template_id, owner: currentUser });
    if (res.success && res.new_trip_id) {
      // Re-fetch trips to get the newly created trip
      const data = await fetchAPI('get_trips', { owner: currentUser });
      if (data.success) {
        setTrips(data.trips);
        setActiveTripId(res.new_trip_id);
        setNavStack([...navStack, 'trip']);
        setActiveView('trip');
      }
    } else {
      alert(res.error || 'Failed to use template');
    }
  };

  const createCategory = async (name, color, icon) => {
    const id = generateId();
    await fetchAPI('create_category', { id, owner: currentUser, name, color, icon });
    setCategories([...categories, { id, owner: currentUser, name, color, icon }]);
  };

  const deleteCategory = async (id) => {
    await fetchAPI('delete_category', { id });
    setCategories(categories.filter(c => c.id !== id));
  };

  const updateCategory = async (id, name, color, icon) => {
    await fetchAPI('update_category', { id, name, color, icon });
    setCategories(categories.map(c => c.id === id ? { ...c, name, color, icon } : c));
  };

  const updateUser = async (profileData) => {
    const res = await fetchAPI('update_user', { username: currentUser, ...profileData });
    return res;
  };

  const updateProfile = async (profileData) => {
    await fetchAPI('update_profile', { username: currentUser, ...profileData });
  };

  const markNotificationRead = async (id) => {
    await fetchAPI('mark_notification_read', { id });
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  const markAllNotificationsRead = async () => {
    await fetchAPI('mark_all_notifications_read', { user_id: currentUser });
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const navigateTo = (view, tripId = null) => {
    setActiveTripId(tripId || activeTripId);
    setActiveView(view);
  };

  const value = {
    currentUser, trips, categories, templates, notifications, unreadCount,
    activeTrip, isLoading,
    loginUser, registerUser, logout,
    createTrip, updateTrip, deleteTrip,
    addSchedule, updateSchedule, updateSchedulePhotos, deleteSchedule,
    addFriend, removeFriend,
    globalFriends, searchUsers, addGlobalFriend, removeGlobalFriend,
    joinTrip,
    exportTrip, importTrip,
    saveTemplate, deleteTemplate, useTemplate,
    createCategory, deleteCategory, updateCategory,
    updateProfile, updateUser,
    markNotificationRead, markAllNotificationsRead,
    navigateTo, activeView,
    darkMode, toggleDarkMode,
    themeColor, setThemeColor,
    bgColor, setBgColor,
    toastMessage, showToast,
    fetchAPI
  };

  return (
    <TripContext.Provider value={value}>
      {children}
      <ToastNotification />
      {showLogoutModal && (
        <>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setShowLogoutModal(false)}></div>
          <div className="position-fixed top-50 start-50 translate-middle bg-white p-4 rounded-4 shadow-lg text-center animate-fade-in" style={{ zIndex: 1050, width: '90%', maxWidth: '320px' }}>
            <div className="mb-3 text-danger">
              <Icon name="log-out" size={48} />
            </div>
            <h5 className="fw-bold mb-2">Log out</h5>
            <p className="text-muted mb-4 text-sm">Are you sure you want to log out of your account?</p>
            <div className="d-flex gap-2">
              <button className="btn btn-light flex-grow-1 fw-bold" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="btn btn-danger flex-grow-1 fw-bold" onClick={confirmLogout}>Yes, Log out</button>
            </div>
          </div>
        </>
      )}
    </TripContext.Provider>
  );
};

// Icons
const icons = {
  'dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  map: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  loader: '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'pie-chart': '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  'share-2': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'plus-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v11z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  download2: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'monitor': '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  'list': '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
  'check': '<polyline points="20 6 9 17 4 12"/>',
  'star': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'edit-2': '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  'rotate-ccw': '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  'send': '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  'play': '<polygon points="5 3 19 12 5 21 5 3"/>',
  'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
  'smartphone': '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
};

const Icon = ({ name, size = 20, className = "", color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} dangerouslySetInnerHTML={{ __html: icons[name] || icons.info }} />
);

// Auth Page
const AuthPage = () => {
  const { loginUser, registerUser } = useTrip();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Username and password are required'); return; }
    setLoading(true);
    const res = isLogin ? await loginUser(username, password) : await registerUser(username, password, email);
    setLoading(false);
    if (!res.success) setError(res.message);
  };

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="text-center mb-4">
          <div className="icon-circle">
            <Icon name="map" size={24} />
          </div>
          <h2 className="fw-bold">TripNan</h2>
          <p className="text-muted">{isLogin ? 'Welcome back!' : 'Create your account'}</p>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Username</label>
            <div className="input-group">
              <span className="input-group-text"><Icon name="user" size={16} /></span>
              <input type="text" className="form-control" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text"><Icon name="lock" size={16} /></span>
              <input type="password" className="form-control" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </div>
          {!isLogin && <div className="mb-3">
            <label className="form-label">Email (optional)</label>
            <div className="input-group">
              <span className="input-group-text"><Icon name="mail" size={16} /></span>
              <input type="email" className="form-control" placeholder="Enter email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>}
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            <Icon name={isLogin ? 'log-in' : 'user-plus'} size={18} className="me-2" />
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <p className="text-center mt-3 text-muted small">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button className="btn btn-link p-0" onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Register' : 'Login'}</button>
        </p>
      </div>
    </div>
  );
};

// Enhanced Photo Gallery Component with hover zoom, download, and preview
const PhotoGallery = ({ photos = [], onAdd, onDelete, editable = false, showHeader = true }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const count = photos.length + (editable ? 1 : 0);
  const gridClass = count === 1 ? 'single' : count === 2 ? 'multiple-2' : count === 3 ? 'multiple-3' : count === 4 ? 'multiple-4' : 'multiple-n';

  const handleDownload = (photo, index) => {
    const a = document.createElement('a');
    a.href = photo;
    a.download = `photo_${index + 1}.jpg`;
    a.click();
  };

  return (
    <>
      {showHeader && photos.length > 0 && (
        <div className="photo-gallery-header">
          <h6><Icon name="camera" size={14} /> Photos ({photos.length})</h6>
        </div>
      )}
      <div className={`photo-gallery ${gridClass}`}>
        {photos.map((photo, i) => (
          <div key={i} className="photo-item" onClick={() => setPreviewImage(photo)}>
            <img src={photo} alt={`Photo ${i + 1}`} loading="lazy" />
            <span className="photo-number">{i + 1}</span>
            <div className="photo-overlay">
              <button className="photo-action" onClick={(e) => { e.stopPropagation(); handleDownload(photo, i); }} title="Download Photo">
                <Icon name="download" size={18} />
              </button>
              {editable && (
                <button className="photo-action delete" onClick={(e) => { e.stopPropagation(); onDelete(i); }} title="Delete Photo">
                  <Icon name="trash" size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        {editable && onAdd && (
          <label className="add-photo-btn">
            <Icon name="camera" size={28} />
            <span className="small fw-semibold">Add Photo</span>
            <input type="file" accept="image/*" onChange={onAdd} style={{ display: 'none' }} multiple />
          </label>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="image-preview-modal animate-scale-in" onClick={() => setPreviewImage(null)}>
          <button className="close-btn" onClick={() => setPreviewImage(null)}>
            <Icon name="x" size={24} />
          </button>
          <img src={previewImage} alt="Preview" onClick={(e) => e.stopPropagation()} />
          <button
            className="btn btn-light position-absolute"
            style={{ bottom: 30, left: '50%', transform: 'translateX(-50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              const link = document.createElement('a');
              link.href = previewImage;
              link.download = `photo_${Date.now()}.jpg`;
              link.click();
            }}
          >
            <Icon name="download" size={18} /> Download
          </button>
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------
// Helper: Calculate Trip Duration
// ---------------------------------------------------------
const calculateTripDuration = (schedules) => {
  if (!schedules || schedules.length === 0) return '';
  const dates = schedules.map(s => {
    const time = s.time || '00:00';
    return new Date(`${s.date}T${time}`).getTime();
  });
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  
  const diffMs = maxDate - minDate;
  let days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) days = 1; // At least 1 day
  
  const startDate = new Date(minDate);
  const dd = String(startDate.getDate()).padStart(2, '0');
  const mm = String(startDate.getMonth() + 1).padStart(2, '0');
  const yyyy = startDate.getFullYear();
  
  return `${days} Day${days > 1 ? 's' : ''} • ${dd}/${mm}/${yyyy}`;
};

// My Trips Page
const MyTrips = () => {
  const { trips, createTrip, joinTrip, navigateTo, isLoading, categories, logout, unreadCount, currentUser } = useTrip();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', budget: '', category_id: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [coverPreview, setCoverPreview] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // list or grid

  const handleCreate = async (e) => {
    e.preventDefault();
    await createTrip(newTrip.name, newTrip.budget, newTrip.category_id || null, coverPreview);
    setNewTrip({ name: '', budget: '', category_id: '' });
    setCoverPreview(null);
    setShowCreate(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode) return;
    const res = await joinTrip(joinCode);
    if (res.success) {
      setShowJoin(false);
      setJoinCode('');
      alert(res.message);
    } else {
      setJoinError(res.message);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setCoverPreview(compressed);
  };

  const filtered = filterCat ? trips.filter(t => t.category_id === filterCat) : trips;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 10) return 'Selamat Pagi';
    if (hour >= 10 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="row align-items-center mb-4 gap-3 gap-md-0">
          <div className="col-12 col-md-auto">
            <h4 className="text-muted mb-2 fw-normal">{getGreeting()}, <span className="fw-bold" style={{ color: 'var(--primary)' }}>{currentUser}</span>!</h4>
            <div className="placeholder-glow"><span className="placeholder col-6 fs-3 rounded"></span></div>
            <div className="placeholder-glow"><span className="placeholder col-4 rounded mt-1"></span></div>
          </div>
        </div>
        <div className="row g-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={viewMode === 'grid' ? 'col-6 col-md-4' : 'col-12'}>
              <div className="card-trip trip-card placeholder-glow" style={{ height: '280px' }}>
                <div className="trip-cover placeholder w-100" style={{ height: '140px' }}></div>
                <div className="card-body">
                  <span className="placeholder col-8 mb-2 rounded"></span>
                  <span className="placeholder col-4 mb-3 rounded"></span>
                  <span className="placeholder col-12 mb-2 rounded"></span>
                  <span className="placeholder col-12 rounded"></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="row align-items-center mb-4 gap-3 gap-md-0">
        <div className="col-12 col-md-auto">
          <h4 className="text-muted mb-2 fw-normal">{getGreeting()}, <span className="fw-bold" style={{ color: 'var(--primary)' }}>{currentUser}</span>!</h4>
          <h1 className="h3 fw-bold mb-1">My Trips</h1>
          <p className="text-muted mb-0">{trips.length} trips planned</p>
        </div>
        <div className="col-12 col-md d-flex justify-content-md-end flex-wrap gap-2">
          <div className="position-relative" style={{ flexGrow: 1, minWidth: '150px', height: '39px' }}>
            <button 
              className="form-select text-start" 
              type="button" 
              onClick={() => setShowCatDropdown(!showCatDropdown)}
              style={{ width: '100%', height: '100%' }}
            >
              {filterCat === '' ? 'All Categories' : (categories.find(c => c.id == filterCat)?.name || 'All Categories')}
            </button>
            {showCatDropdown && (
              <>
                <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 999 }} onClick={() => setShowCatDropdown(false)}></div>
                <ul className="dropdown-menu shadow show py-1 w-100" style={{ position: 'absolute', left: 0, top: '100%', zIndex: 1000, marginTop: '4px', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto' }}>
                  <li>
                    <button 
                      className={`dropdown-item py-2 text-truncate ${filterCat === '' ? 'bg-light text-primary fw-bold' : ''}`} 
                      onClick={() => { setFilterCat(''); setShowCatDropdown(false); }}
                    >
                      All Categories
                    </button>
                  </li>
                  {categories.map(c => (
                    <li key={c.id}>
                      <button 
                        className={`dropdown-item py-2 text-truncate ${filterCat == c.id ? 'bg-light text-primary fw-bold' : ''}`} 
                        onClick={() => { setFilterCat(c.id); setShowCatDropdown(false); }}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {showCreate || showJoin ? (
            <button className="btn btn-outline-secondary" onClick={() => { setShowCreate(false); setShowJoin(false); }}>
              <Icon name="x" size={16} /> Cancel
            </button>
          ) : (
            <div className="position-relative" style={{ display: 'inline-block' }}>
              <button className="btn btn-light border d-flex align-items-center gap-2" type="button" onClick={() => setShowDropdown(!showDropdown)} style={{ backgroundColor: '#f8f9fa' }}>
                Add New <Icon name={showDropdown ? "chevron-up" : "chevron-down"} size={16} />
              </button>
              {showDropdown && (
                <>
                  <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 999 }} onClick={() => setShowDropdown(false)}></div>
                  <ul className="dropdown-menu shadow show py-2" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000, marginTop: '8px', minWidth: '180px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <li><button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { setShowDropdown(false); setShowCreate(true); }}><Icon name="plus-circle" size={16} className="me-2 text-primary" />Create New Trip</button></li>
                    <li><button className="dropdown-item py-2 d-flex align-items-center" onClick={() => { setShowDropdown(false); setShowJoin(true); }}><Icon name="users" size={16} className="me-2 text-success" />Join via Code</button></li>
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="btn-group border bg-white rounded-3 shadow-sm d-flex" style={{ padding: '2px', height: '39px' }}>
            <button className={`btn btn-sm d-flex align-items-center justify-content-center ${viewMode === 'grid' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted'}`} onClick={() => setViewMode('grid')} style={{ padding: '0 12px', height: '100%' }} title="Grid View">
              <Icon name="layout" size={16} />
            </button>
            <button className={`btn btn-sm d-flex align-items-center justify-content-center ${viewMode === 'list' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted'}`} onClick={() => setViewMode('list')} style={{ padding: '0 12px', height: '100%' }} title="List View">
              <Icon name="list" size={16} />
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="card-trip mb-4 animate-fade-in" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body p-4">
            <h5 className="fw-bold mb-3">Create New Trip</h5>
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Trip Name</label>
                  <input type="text" className="form-control" placeholder="Bali Adventure 2026" value={newTrip.name} onChange={e => setNewTrip({...newTrip, name: e.target.value})} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Budget (IDR)</label>
                  <div className="input-group">
                    <span className="input-group-text">Rp</span>
                    <input type="text" inputMode="numeric" className="form-control" placeholder="5,000,000" value={newTrip.budget} onChange={e => setNewTrip({...newTrip, budget: formatCurrency(e.target.value)})} required />
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={newTrip.category_id} onChange={e => setNewTrip({...newTrip, category_id: e.target.value})}>
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cover Photo</label>
                  <div className="d-flex gap-2 align-items-center">
                    {coverPreview && <img src={coverPreview} alt="Cover" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8 }} />}
                    <label className="btn btn-outline-primary btn-sm">
                      <Icon name="camera" size={14} /> Upload Cover
                      <input type="file" accept="image/*" onChange={handleCoverUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3">Create Trip</button>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="card-trip mb-4 animate-fade-in" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body p-4">
            <h5 className="fw-bold mb-3">Join a Trip</h5>
            <form onSubmit={handleJoin}>
              {joinError && <div className="alert alert-danger p-2 small">{joinError}</div>}
              <div className="row g-3 align-items-end">
                <div className="col-md-8">
                  <label className="form-label">Trip Code</label>
                  <input type="text" className="form-control" placeholder="Enter 6-character code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} required />
                </div>
                <div className="col-md-4">
                  <button type="submit" className="btn btn-primary w-100">Join Trip</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="compass" size={64} />
          <h4 className="fw-bold">No trips yet</h4>
          <p>Create your first trip to get started!</p>
        </div>
      ) : (
        <>
          {(() => {
            const inProgressTrips = filtered.filter(t => !t.is_finished);
            const completedTrips = filtered.filter(t => t.is_finished);
            
            const renderTripCards = (tripList) => (
              <div className="row g-4">
                {tripList.map((trip, index) => {
                  const completed = trip.schedules?.filter(s => s.isCompleted).length || 0;
                  const total = trip.schedules?.length || 0;
                  const progress = total ? Math.round((completed / total) * 100) : 0;
                  const cat = categories.find(c => c.id === trip.category_id);
                  const isEager = index < 2;
                  return (
                    <div key={trip.id} className={viewMode === 'grid' ? 'col-6 col-md-4' : 'col-12'}>
                      <div className="card-trip trip-card" onClick={() => navigateTo('trip-dashboard', trip.id)}>
                        <div className="trip-cover" style={{ background: trip.coverUrl ? 'transparent' : 'linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%)' }}>
                          {trip.coverUrl && (
                            <img 
                              src={trip.coverUrl} 
                              alt="Trip Cover" 
                              className="cover-img"
                              loading={isEager ? "eager" : "lazy"} 
                              fetchpriority={isEager ? "high" : "auto"} 
                            />
                          )}
                          <span className="trip-code">{trip.tripCode}</span>
                          {!trip.isOwner && <span className="trip-shared-badge">Shared</span>}
                          {cat && (
                            <span className="badge" style={{ position: 'absolute', bottom: 12, left: 12, background: cat.color, color: 'white' }}>{cat.name}</span>
                          )}
                        </div>
                        <div className="card-body">
                          <h5 className="fw-bold mb-1">{trip.name}</h5>
                          {calculateTripDuration(trip.schedules) && (
                            <p className="small text-primary fw-medium mb-1"><Icon name="calendar" size={14} className="me-1" />{calculateTripDuration(trip.schedules)}</p>
                          )}
                          <p className="text-muted small mb-3">Budget: Rp {parseFloat(trip.totalPlanBudget).toLocaleString('en-US')}</p>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="small text-muted">{completed}/{total} activities</span>
                            <span className="fw-bold" style={{ color: progress === 100 ? 'var(--success)' : 'var(--primary)' }}>{progress}%</span>
                          </div>
                          <div className="progress mt-2">
                            <div className="progress-bar" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : 'var(--primary)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );

            return (
              <>
                {inProgressTrips.length > 0 && (
                  <div className="mb-5">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                      <Icon name="clock" size={20} className="text-warning" /> In Progress
                    </h5>
                    {renderTripCards(inProgressTrips)}
                  </div>
                )}
                
                {completedTrips.length > 0 && (
                  <div>
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                      <Icon name="check-circle" size={20} className="text-success" /> Completed
                    </h5>
                    {renderTripCards(completedTrips)}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

    </div>
  );
};

// Trip Dashboard
const TripDashboard = () => {
  const { activeTrip, updateTrip, deleteTrip, navigateTo } = useTrip();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [coverPreview, setCoverPreview] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEndTripConfirm, setShowEndTripConfirm] = useState(false);

  if (!activeTrip) return null;

  const handleSave = async () => {
    await updateTrip(activeTrip.id, edit);
    if (coverPreview) await updateTrip(activeTrip.id, { coverUrl: coverPreview });
    setEditing(false);
    setCoverPreview(null);
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setCoverPreview(compressed);
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('my-trips')}>
        <Icon name="arrow-left" size={16} /> Back to Trips
      </button>



      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-5">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-1">Workspace</span>
            <span className="badge bg-light text-dark border px-2 py-1 rounded-1 fw-normal">{activeTrip.tripCode}</span>
            {activeTrip.is_finished ? (
              <span className="badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-1">Completed</span>
            ) : (
              <span className="badge bg-warning bg-opacity-10 text-warning px-2 py-1 rounded-1">In Progress</span>
            )}
          </div>
          <h1 className="h2 fw-bold mb-1 text-dark">{activeTrip.name}</h1>
          {calculateTripDuration(activeTrip.schedules) && (
            <p className="fw-medium text-primary mb-1"><Icon name="calendar" size={16} className="me-1" />{calculateTripDuration(activeTrip.schedules)}</p>
          )}
          <p className="text-muted mb-0" style={{ fontSize: '1.1rem' }}>
            Budget: <span className="fw-medium text-dark">Rp {parseFloat(activeTrip.totalPlanBudget).toLocaleString('en-US')}</span>
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary d-flex align-items-center gap-2 px-3" onClick={() => { setEdit(activeTrip); setEditing(true) }}>
            <Icon name="edit" size={16} /> Edit
          </button>
          
          {!activeTrip.is_finished && (
            showEndTripConfirm ? (
              <div className="d-flex align-items-center gap-2 bg-white border border-success rounded px-2">
                <span className="text-success small fw-bold mb-0">End this trip?</span>
                <button className="btn btn-success btn-sm" onClick={() => updateTrip(activeTrip.id, { is_finished: true })}>Ya</button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowEndTripConfirm(false)}>Tidak</button>
              </div>
            ) : (
              <button className="btn btn-outline-success d-flex align-items-center gap-2 px-3" onClick={() => setShowEndTripConfirm(true)}>
                <Icon name="check-square" size={16} /> End Trip
              </button>
            )
          )}

          {showDeleteConfirm ? (
            <div className="d-flex align-items-center gap-2 bg-white border border-danger rounded px-2">
              <span className="text-danger small fw-bold mb-0">Hapus Trip ini?</span>
              <button className="btn btn-danger btn-sm" onClick={() => deleteTrip(activeTrip.id)}>Ya</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowDeleteConfirm(false)}>Tidak</button>
            </div>
          ) : (
            <button className="btn btn-outline-danger d-flex align-items-center gap-2 px-3" onClick={() => setShowDeleteConfirm(true)}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="card-trip mb-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">Edit Trip</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Name</label>
                <input className="form-control" value={edit.name || ''} onChange={e => setEdit({...edit, name: e.target.value})} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Budget</label>
                <input type="text" inputMode="numeric" className="form-control" value={formatCurrency(edit.totalPlanBudget)} onChange={e => setEdit({...edit, totalPlanBudget: parseCurrency(e.target.value)})} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Cover Photo</label>
                <div className="d-flex gap-2">
                  {(coverPreview || edit.coverUrl) && <img src={coverPreview || edit.coverUrl} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 8 }} />}
                  <label className="btn btn-outline-primary btn-sm">
                    <Icon name="camera" size={14} /> Change
                    <input type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
              <button className="btn btn-outline-secondary ms-2" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="row g-4">
        {[
          { key: 'itinerary', icon: 'calendar', color: 'var(--primary)', title: 'Itinerary', desc: `${activeTrip.schedules?.filter(s => !s.is_addon).length || 0} activities` },
          { key: 'addons', icon: 'tag', color: 'var(--info)', title: 'Add-ons', desc: `${activeTrip.schedules?.filter(s => s.is_addon).length || 0} add-ons` },
          { key: 'friends', icon: 'users', color: 'var(--success)', title: 'Travel Buddies', desc: `${activeTrip.friends?.length || 0} friends` },
          { key: 'budget', icon: 'pie-chart', color: 'var(--warning)', title: 'Budget Report', desc: 'View analytics' }
        ].map(m => (
          <div key={m.key} className="col-6 col-md-3">
            <div className="module-card h-100" onClick={() => navigateTo(m.key)}>
              <div className="module-icon" style={{ background: m.color }}><Icon name={m.icon} size={28} /></div>
              <h4 className="fw-bold mb-1 fs-5">{m.title}</h4>
              <p className="text-muted small mb-0">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Itinerary Page
const Itinerary = () => {
  const { activeTrip, addSchedule, navigateTo } = useTrip();
  const [showAdd, setShowAdd] = useState(false);
  const [newSch, setNewSch] = useState({ date: '', time: '', title: '', planBudget: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSch.date || !newSch.title) return;
    await addSchedule({ date: newSch.date, time: newSch.time, title: newSch.title, planBudget: parseCurrency(newSch.planBudget) });
    setNewSch({ date: '', time: '', title: '', planBudget: '' });
    setShowAdd(false);
  };

  const sorted = [...(activeTrip.schedules || [])]
    .filter(s => !s.is_addon)
    .sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return new Date(`${a.date}T${timeA}`) - new Date(`${b.date}T${timeB}`);
    });

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('trip-dashboard')}><Icon name="arrow-left" size={16} /> Back</button>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div><h2 className="fw-bold mb-1">Itinerary</h2><p className="text-muted mb-0">Plan your activities</p></div>
        {!activeTrip.is_finished && (
          <button className={`btn ${showAdd ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowAdd(!showAdd)}>
            <Icon name={showAdd ? 'x' : 'plus'} size={16} /> {showAdd ? 'Cancel' : 'Add Activity'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card-trip mb-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">New Activity</h5>
            <form onSubmit={handleAdd}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={newSch.date} onChange={e => setNewSch({...newSch, date: e.target.value})} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Time <span className="text-muted fw-normal">(Opt)</span></label>
                  <input type="time" className="form-control" value={newSch.time} onChange={e => setNewSch({...newSch, time: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-control" placeholder="Visit amazing places" value={newSch.title} onChange={e => setNewSch({...newSch, title: e.target.value})} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Budget (IDR)</label>
                  <div className="input-group">
                    <span className="input-group-text">Rp</span>
                    <input type="text" inputMode="numeric" className="form-control" placeholder="0" value={newSch.planBudget} onChange={e => setNewSch({...newSch, planBudget: formatCurrency(e.target.value)})} />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3"><Icon name="save" size={16} className="me-2" /> Save Activity</button>
            </form>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendar" size={64} />
          <h4 className="fw-bold">No activities yet</h4>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {sorted.map(s => <ScheduleCard key={s.id} schedule={s} />)}
        </div>
      )}
    </div>
  );
};

// Add-Ons Page
const AddOns = () => {
  const { activeTrip, addSchedule, navigateTo } = useTrip();
  const [showAdd, setShowAdd] = useState(false);
  const [newSch, setNewSch] = useState({ date: '', time: '', title: '', planBudget: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSch.date || !newSch.title) return;
    await addSchedule({ date: newSch.date, time: newSch.time, title: newSch.title, planBudget: parseCurrency(newSch.planBudget), is_addon: true });
    setNewSch({ date: '', time: '', title: '', planBudget: '' });
    setShowAdd(false);
  };

  const sorted = [...(activeTrip.schedules || [])]
    .filter(s => s.is_addon)
    .sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return new Date(`${a.date}T${timeA}`) - new Date(`${b.date}T${timeB}`);
    });

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('trip-dashboard')}><Icon name="arrow-left" size={16} /> Back</button>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div><h2 className="fw-bold mb-1">Add-ons</h2><p className="text-muted mb-0">Plan minor expenses (parking, snacks, etc.)</p></div>
        {!activeTrip.is_finished && (
          <button className={`btn ${showAdd ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowAdd(!showAdd)}>
            <Icon name={showAdd ? 'x' : 'plus'} size={16} /> {showAdd ? 'Cancel' : 'Add Add-on'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="card-trip mb-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">New Add-on</h5>
            <form onSubmit={handleAdd}>
              <div className="row g-3">
                <div className="col-md-3">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={newSch.date} onChange={e => setNewSch({...newSch, date: e.target.value})} required />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Time <span className="text-muted fw-normal">(Opt)</span></label>
                  <input type="time" className="form-control" value={newSch.time} onChange={e => setNewSch({...newSch, time: e.target.value})} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-control" placeholder="Toll, Parking, Snack..." value={newSch.title} onChange={e => setNewSch({...newSch, title: e.target.value})} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Budget (IDR)</label>
                  <div className="input-group">
                    <span className="input-group-text">Rp</span>
                    <input type="text" inputMode="numeric" className="form-control" placeholder="0" value={newSch.planBudget} onChange={e => setNewSch({...newSch, planBudget: formatCurrency(e.target.value)})} />
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3"><Icon name="save" size={16} className="me-2" /> Save Add-on</button>
            </form>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Icon name="tag" size={64} />
          <h4 className="fw-bold">No add-ons yet</h4>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {sorted.map(s => <ScheduleCard key={s.id} schedule={s} />)}
        </div>
      )}
    </div>
  );
};

// Schedule Card with Enhanced Multi-Photo Support
const ScheduleCard = ({ schedule }) => {
  const { updateSchedule, deleteSchedule, fetchAPI, updateSchedulePhotos } = useTrip();
  const [showComplete, setShowComplete] = useState(false);
  const [realBudget, setRealBudget] = useState(formatCurrency(schedule.realBudget || ''));
  const [photos, setPhotos] = useState(schedule.photos || []);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ 
    title: schedule.title, 
    date: schedule.date, 
    time: schedule.time || '', 
    planBudget: formatCurrency(schedule.planBudget) 
  });

  useEffect(() => {
    // If photos are not loaded yet, but schedule has photos, fetch them lazily
    if (schedule.has_photos && photos.length === 0 && !loadingPhotos) {
      setLoadingPhotos(true);
      fetchAPI('get_schedule_photos', { id: schedule.id }).then(res => {
        if (res.success && res.photos) {
          setPhotos(res.photos);
          // Only update local array to avoid triggering another API update call
          schedule.photos = res.photos;
        }
        setLoadingPhotos(false);
      });
    }
  }, [schedule.id, schedule.has_photos]);

  // Handle multiple file uploads
  const handlePhotoAdd = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos = [...photos];
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      newPhotos.push(compressed);
    }
    setPhotos(newPhotos);
    updateSchedule(schedule.id, { photos: newPhotos });
    e.target.value = '';
  };

  const handlePhotoDelete = (i) => {
    const newPhotos = photos.filter((_, idx) => idx !== i);
    setPhotos(newPhotos);
    updateSchedule(schedule.id, { photos: newPhotos });
  };

  const handleComplete = () => {
    updateSchedule(schedule.id, { 
      isCompleted: true, 
      realBudget: parseCurrency(realBudget), 
      completed_at: new Date().toISOString(),
      photos 
    });
    setShowComplete(false);
  };

  const handleSaveEdit = () => {
    updateSchedule(schedule.id, { 
      title: editForm.title, 
      date: editForm.date, 
      time: editForm.time, 
      planBudget: parseCurrency(editForm.planBudget) 
    });
    setIsEditing(false);
  };

  return (
    <div className={`schedule-item ${schedule.isCompleted ? 'completed' : ''}`}>
      <div className="card-body">
        {isEditing ? (
          <div className="mb-3 p-3 bg-light rounded border">
            <h6 className="fw-bold mb-3">Edit Activity</h6>
            <div className="row g-2 mb-3">
              <div className="col-12">
                <input type="text" className="form-control" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} placeholder="Title" />
              </div>
              <div className="col-6">
                <input type="date" className="form-control" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
              </div>
              <div className="col-6">
                <input type="time" className="form-control" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} />
              </div>
              <div className="col-12">
                 <div className="input-group">
                   <span className="input-group-text">Rp</span>
                   <input type="text" inputMode="numeric" className="form-control" placeholder="Plan Budget" value={editForm.planBudget} onChange={e => setEditForm({...editForm, planBudget: formatCurrency(e.target.value)})} />
                 </div>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setIsEditing(false)}><Icon name="x" size={14} className="me-1" /> Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}><Icon name="save" size={14} className="me-1" /> Save</button>
            </div>
          </div>
        ) : (
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 className="fw-bold mb-1">{schedule.title}</h5>
              <span className="badge bg-light text-dark"><Icon name="calendar" size={12} /> {new Date(schedule.date).toLocaleDateString()}</span>
              {schedule.time && <span className="badge bg-light text-dark ms-2"><Icon name="clock" size={12} /> {schedule.time}</span>}
            </div>
            <div className="text-end">
              <p className="text-muted small mb-1">Plan: Rp {parseFloat(schedule.planBudget || 0).toLocaleString('en-US')}</p>
              {schedule.isCompleted && (
                <p className={`fw-bold mb-0 ${schedule.realBudget > schedule.planBudget ? 'text-danger' : 'text-success'}`}>
                  Real: Rp {parseFloat(schedule.realBudget || 0).toLocaleString('en-US')}
                </p>
              )}
            </div>
          </div>
        )}

        {(schedule.isCompleted || isEditing) && (
          <PhotoGallery
            photos={photos}
            editable={isEditing}
            onAdd={handlePhotoAdd}
            onDelete={handlePhotoDelete}
          />
        )}
        
        {loadingPhotos && (
          <div className="text-center py-2">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2 text-muted small">Loading photos...</span>
          </div>
        )}

        <div className="mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
          {!schedule.isCompleted ? (
            showComplete ? (
              <div className="w-100">
                <div className="row g-2 align-items-end">
                  <div className="col">
                    <input type="text" inputMode="numeric" className="form-control" placeholder="Actual spending" value={realBudget} onChange={e => setRealBudget(formatCurrency(e.target.value))} />
                  </div>
                  <div className="col-auto">
                    <button className="btn btn-success btn-sm" onClick={handleComplete}><Icon name="check" size={14} className="me-1" /> Confirm</button>
                    <button className="btn btn-outline-secondary btn-sm ms-2" onClick={() => setShowComplete(false)}><Icon name="x" size={14} className="me-1" /> Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-100 d-flex flex-nowrap gap-2">
                  <button className="btn btn-success btn-sm flex-grow-1" onClick={() => setShowComplete(true)}><Icon name="check-circle" size={14} /> Complete</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setIsEditing(true)}><Icon name="edit" size={14} /></button>
                  {showDeleteConfirm ? (
                    <div className="d-flex align-items-center gap-1 border border-danger rounded px-1">
                      <span className="text-danger small ms-1 me-1 fw-bold">Hapus?</span>
                      <button className="btn btn-danger btn-sm px-2 py-0" onClick={() => deleteSchedule(schedule.id)}><Icon name="check" size={12} className="me-1" /> Ya</button>
                      <button className="btn btn-secondary btn-sm px-2 py-0" onClick={() => setShowDeleteConfirm(false)}><Icon name="x" size={12} className="me-1" /> Tidak</button>
                    </div>
                  ) : (
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}><Icon name="trash" size={14} /></button>
                  )}
              </div>
            )
          ) : (
            <div className="w-100 d-flex justify-content-between align-items-center">
              <div>
                <span className="badge bg-success"><Icon name="check-circle" size={12} /> Completed</span>
                {schedule.completed_at && (
                  <span className="text-muted small ms-2" style={{ fontSize: '11px' }}>
                    <Icon name="clock" size={10} className="me-1" />
                    {new Date(schedule.completed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
              </div>
              <div>
                <button className="btn btn-outline-secondary btn-sm me-2" onClick={() => setIsEditing(true)}><Icon name="edit" size={14} /></button>
                {showDeleteConfirm ? (
                  <div className="d-inline-flex align-items-center gap-1 border border-danger rounded px-1 py-1">
                    <span className="text-danger small ms-1 me-1 fw-bold">Hapus?</span>
                    <button className="btn btn-danger btn-sm px-2 py-0" onClick={() => deleteSchedule(schedule.id)}><Icon name="check" size={12} className="me-1" /> Ya</button>
                    <button className="btn btn-secondary btn-sm px-2 py-0" onClick={() => setShowDeleteConfirm(false)}><Icon name="x" size={12} className="me-1" /> Tidak</button>
                  </div>
                ) : (
                  <button className="btn btn-outline-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}><Icon name="trash" size={14} /></button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Friends Page
const Friends = () => {
  const { activeTrip, addFriend, removeFriend, navigateTo } = useTrip();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (!activeTrip) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    await addFriend(name, email);
    setName('');
    setEmail('');
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('trip-dashboard')}><Icon name="arrow-left" size={16} /> Back</button>
      <h2 className="fw-bold mb-4">Travel Buddies</h2>
      <div className="row g-4">
        <div className="col-md-5">
          <div className="card-trip text-center mb-4">
            <div className="card-body p-4">
              <p className="text-muted small fw-bold mb-1">INVITE CODE</p>
              <h2 className="fw-bold letter-spacing-1 mb-2">{activeTrip.tripCode}</h2>
              <p className="text-muted small">Share this code with friends</p>
            </div>
          </div>
          <div className="card-trip" style={{ borderColor: 'var(--success)' }}>
            <div className="card-body p-4">
              <h5 className="fw-bold mb-3" style={{ color: 'var(--success)' }}><Icon name="user-plus" size={18} /> Add Friend</h5>
              <form onSubmit={handleAdd}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-success w-100"><Icon name="user-plus" size={16} className="me-2" /> Add Friend</button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md-7">
          <div className="card-trip h-100">
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4">Friends ({activeTrip.friends?.length || 0})</h5>
              {(activeTrip.friends || []).length === 0 ? (
                <p className="text-muted text-center py-4">No friends yet</p>
              ) : (
                <div className="list-group list-group-flush">
                  {activeTrip.friends.map(f => (
                    <div key={f.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-light d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                          <Icon name="user" size={18} className="text-muted" />
                        </div>
                        <div>
                          <p className="fw-bold mb-0">{f.name}</p>
                          <p className="text-muted small mb-0">{f.email}</p>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeFriend(f.id)}><Icon name="trash" size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Budget Page
const BudgetReport = () => {
  const { activeTrip, navigateTo } = useTrip();
  if (!activeTrip) return null;

  const schedules = activeTrip.schedules || [];
  const totalPlan = parseFloat(activeTrip.totalPlanBudget || 0);
  const totalReal = schedules.filter(s => s.isCompleted).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  
  const itineraryReal = schedules.filter(s => s.isCompleted && !s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  const addonReal = schedules.filter(s => s.isCompleted && s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  
  const diff = totalReal - totalPlan;
  const isOver = diff > 0;
  const completion = schedules.length ? (schedules.filter(s => s.isCompleted).length / schedules.length) * 100 : 0;

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4 d-flex align-items-center gap-1" onClick={() => navigateTo('trip-dashboard')}><Icon name="arrow-left" size={16} /> Back</button>
      <h2 className="fw-bold mb-4">Budget Analytics</h2>
      
      <div className="card-trip mb-4 overflow-hidden border">
        <div className="card-body p-4 p-md-5 text-center border-bottom" style={{ background: isOver ? 'linear-gradient(135deg, #fff, #fef2f2)' : 'linear-gradient(135deg, #fff, #f0fdf4)' }}>
          {completion === 0 ? (
            <div className="text-muted py-4">
              <Icon name="pie-chart" size={60} className="opacity-25 mb-3" />
              <h4>No Data</h4>
            </div>
          ) : (
            <div className="py-2">
              {isOver ? <Icon name="alert-circle" size={60} className="text-danger mb-3" /> : <Icon name="check-circle" size={60} className="text-success mb-3" />}
              <h1 className={`display-4 fw-bold ${isOver ? 'text-danger' : 'text-success'}`}>{isOver ? 'OVER BUDGET' : 'ON BUDGET'}</h1>
              <p className="fs-5 text-muted mb-0">
                {isOver ? <>Over by <strong className="text-danger">Rp {diff.toLocaleString('en-US')}</strong></> : <>Saving <strong className="text-success">Rp {Math.abs(diff).toLocaleString('en-US')}</strong></>}
              </p>
            </div>
          )}
        </div>
        
        <div className="card-body p-4 p-md-5">
          <div className="row g-4 mb-4 text-center">
            <div className="col-6 border-end">
              <p className="text-muted small fw-bold mb-2">BUDGET</p>
              <h3 className="fw-bold" style={{ color: 'var(--primary)' }}>Rp {totalPlan.toLocaleString('en-US')}</h3>
            </div>
            <div className="col-6">
              <p className="text-muted small fw-bold mb-2">ACTUAL</p>
              <h3 className={`fw-bold ${isOver ? 'text-danger' : 'text-success'}`}>Rp {totalReal.toLocaleString('en-US')}</h3>
            </div>
          </div>
          
          <div className="p-4 bg-light rounded-3 border">
            <h5 className="fw-bold mb-1">Trip Allowance</h5>
            <p className="text-muted small mb-3">Total Budget: Rp {parseFloat(activeTrip.totalPlanBudget).toLocaleString('en-US')}</p>
            
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Itinerary Spending:</span>
                <span className="fw-medium small">Rp {itineraryReal.toLocaleString('en-US')}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Add-ons Spending:</span>
                <span className="fw-medium small">Rp {addonReal.toLocaleString('en-US')}</span>
              </div>
            </div>

            {totalReal > activeTrip.totalPlanBudget ? (
              <div className="alert alert-danger mb-0 py-2 px-3 d-flex align-items-center gap-2"><Icon name="alert-triangle" size={18} /> Exceeded by Rp {(totalReal - activeTrip.totalPlanBudget).toLocaleString('en-US')}</div>
            ) : (
              <div className="alert alert-success mb-0 py-2 px-3 d-flex align-items-center gap-2"><Icon name="check-circle" size={18} /> Rp {(activeTrip.totalPlanBudget - totalReal).toLocaleString('en-US')} remaining</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Settings Page
const SettingsPage = () => {
  const { currentUser, navigateTo, updateUser, darkMode, toggleDarkMode, logout, categories, createCategory, deleteCategory, updateCategory, themeColor, setThemeColor, bgColor, setBgColor, showToast, fetchAPI } = useTrip();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('account');
  const [mobileView, setMobileView] = useState('menu');

  // Account state
  const [fullName, setFullName] = useState(currentUser || '');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Fetch profile on mount
    fetchAPI('get_profile', { username: currentUser }).then(res => {
      if (res && res.success && res.profile) {
        const p = res.profile;
        setFullName(p.full_name || currentUser || '');
        setEmail(p.email || '');
        setDob(p.dob || '');
        setGender(p.gender || '');
        setCity(p.city || '');
        setProfilePic(p.avatar || null);
      }
    });
  }, [currentUser]);
  
  // App preferences state
  const [language, setLanguage] = useState('id');
  const [aboutTab, setAboutTab] = useState('version');
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  // Category state
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#0d6efd');
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');

  const handleSaveAccountClick = (e) => {
    e.preventDefault();
    setShowConfirmSaveModal(true);
  };

  const handleConfirmSaveAccount = async () => {
    setShowConfirmSaveModal(false);
    setIsSaving(true);
    const profileData = {
      full_name: fullName,
      email: email,
      dob: dob,
      gender: gender,
      city: city,
      avatar: profilePic,
      password: password
    };
    const res = await updateUser(profileData); 
    setIsSaving(false);
    if (res && res.success) {
      showToast('Perubahan berhasil disimpan!', 'success');
      setPassword('');
    } else {
      showToast(res?.message || 'Gagal menyimpan perubahan', 'danger');
    }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file, 200); // reuse compressImage function
      setProfilePic(compressed);
    }
  };

  const clearCache = () => {
    showToast('Cache berhasil dibersihkan! Aplikasi akan terasa lebih ringan dan cepat.', 'success');
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    await createCategory(catName, catColor, 'tag');
    setCatName('');
    setShowCatForm(false);
  };

  const startEditCategory = (cat) => {
    setEditCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
  };

  const handleUpdateCategory = async (id) => {
    await updateCategory(id, editCatName, editCatColor, 'tag');
    setEditCatId(null);
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('my-trips')}><Icon name="arrow-left" size={16} /> Back</button>
      <h2 className="fw-bold mb-4"><Icon name="settings" size={24} /> Settings</h2>
      
      <div className={`row g-4 settings-layout ${mobileView === 'menu' ? 'mobile-menu-active' : 'mobile-content-active'}`}>
        <div className="col-md-3 settings-menu-container">
          <div className="settings-sidebar" style={{ position: 'sticky', top: '80px' }}>
            <div className="nav flex-column nav-pills gap-1">
              <button className={`nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'account' ? 'active bg-primary text-white' : 'text-dark'}`} onClick={() => { setActiveTab('account'); setMobileView('content'); }}>
                <Icon name="user" size={18} /> Account
              </button>
              <button className={`nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'categories' ? 'active bg-primary text-white' : 'text-dark'}`} onClick={() => { setActiveTab('categories'); setMobileView('content'); }}>
                <Icon name="tag" size={18} /> Categories
              </button>
              <button className={`nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'appearance' ? 'active bg-primary text-white' : 'text-dark'}`} onClick={() => { setActiveTab('appearance'); setMobileView('content'); }}>
                <Icon name="monitor" size={18} /> Appearance
              </button>
              <button className={`nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'preferences' ? 'active bg-primary text-white' : 'text-dark'}`} onClick={() => { setActiveTab('preferences'); setMobileView('content'); }}>
                <Icon name="settings" size={18} /> Preferensi Sistem
              </button>
              <div>
                <button 
                  className={`nav-link w-100 text-start d-flex align-items-center justify-content-between ${isAboutExpanded ? 'active bg-primary text-white' : 'text-dark'}`} 
                  onClick={() => setIsAboutExpanded(!isAboutExpanded)}
                >
                  <div className="d-flex align-items-center gap-2">
                    <Icon name="info" size={18} /> Tentang
                  </div>
                  <Icon name={isAboutExpanded ? "chevron-up" : "chevron-down"} size={16} />
                </button>
                {isAboutExpanded && (
                  <div className="ps-4 mt-2 mb-1 d-flex flex-column gap-2">
                    <button 
                      className={`btn btn-sm text-start w-100 px-2 py-1 ${activeTab === 'about' && aboutTab === 'version' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`} 
                      onClick={() => { setActiveTab('about'); setAboutTab('version'); setMobileView('content'); }}
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <Icon name="tag" size={14} className="me-2" /> Versi Aplikasi
                    </button>
                    <button 
                      className={`btn btn-sm text-start w-100 px-2 py-1 ${activeTab === 'about' && aboutTab === 'kenali' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`} 
                      onClick={() => { setActiveTab('about'); setAboutTab('kenali'); setMobileView('content'); }}
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <Icon name="info" size={14} className="me-2" /> Kenali TripNan
                    </button>
                    <button 
                      className={`btn btn-sm text-start w-100 px-2 py-1 ${activeTab === 'about' && aboutTab === 'ulas' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`} 
                      onClick={() => { setActiveTab('about'); setAboutTab('ulas'); setMobileView('content'); }}
                      style={{ border: 'none', background: 'transparent' }}
                    >
                      <Icon name="star" size={14} className="me-2" /> Ulas Aplikasi Ini
                    </button>
                  </div>
                )}
              </div>
              <hr className="my-2" />
              <button className="nav-link text-start d-flex align-items-center gap-2 text-danger" onClick={clearCache}>
                <Icon name="trash" size={18} /> Bersihkan Cache
              </button>
              <div className="mt-4 px-2">
                <button className="btn btn-danger text-white w-100 d-flex align-items-center justify-content-center gap-2 py-2" style={{ borderRadius: '10px' }} onClick={logout}>
                  <Icon name="log-out" size={18} /> Logout Akun
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-9 settings-content-container">
          <div className="d-md-none mb-3">
            <button className="btn btn-link text-muted p-0 d-flex align-items-center gap-1" onClick={() => setMobileView('menu')}>
              <Icon name="arrow-left" size={16} /> Back to Menu
            </button>
          </div>
          <div className="card-trip h-100">
            <div className="card-body p-4 p-md-5">
              {activeTab === 'account' && (
                <div className="animate-fade-in">
                  <h5 className="fw-bold mb-4"><Icon name="user" size={18} className="me-2" />Account Settings</h5>
                  <form onSubmit={handleSaveAccountClick} style={{ maxWidth: '600px' }}>
                    <div className="d-flex flex-column align-items-center mb-4">
                      <div className="position-relative" style={{ width: '100px', height: '100px' }}>
                        <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center overflow-hidden w-100 h-100">
                          {profilePic ? (
                            <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Icon name="user" size={48} className="text-muted" />
                          )}
                        </div>
                        <button type="button" className="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }} onClick={() => fileInputRef.current?.click()} title="Ubah Foto Profil">
                          <Icon name="camera" size={14} />
                        </button>
                        <input type="file" ref={fileInputRef} className="d-none" accept="image/*" onChange={handleProfilePicChange} />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold small text-muted"><Icon name="user" size={14} className="me-1" />Username (Read-only)</label>
                      <input type="text" className="form-control" value={currentUser} disabled />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="form-label fw-bold small text-muted"><Icon name="user" size={14} className="me-1" />Nama Lengkap</label>
                        <input type="text" className="form-control" value={fullName} onChange={e => setFullName(e.target.value)} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold small text-muted"><Icon name="mail" size={14} className="me-1" />Email</label>
                        <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold small text-muted"><Icon name="calendar" size={14} className="me-1" />Tanggal Lahir</label>
                        <input type="date" className="form-control" value={dob} onChange={e => setDob(e.target.value)} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold small text-muted"><Icon name="users" size={14} className="me-1" />Jenis Kelamin</label>
                        <select className="form-select" value={gender} onChange={e => setGender(e.target.value)}>
                          <option value="">Pilih...</option>
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-bold small text-muted"><Icon name="map" size={14} className="me-1" />Kota Tempat Tinggal</label>
                        <input type="text" className="form-control" value={city} onChange={e => setCity(e.target.value)} />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="form-label fw-bold small text-muted"><Icon name="lock" size={14} className="me-1" />Password Baru <span className="small text-muted fw-normal">(kosongkan jika tidak diubah)</span></label>
                      <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                      <Icon name="save" size={18} className="me-2" />
                      {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </form>
                  {showConfirmSaveModal && (
                    <>
                      <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setShowConfirmSaveModal(false)}></div>
                      <div className="position-fixed top-50 start-50 translate-middle bg-white p-4 rounded-4 shadow-lg text-center animate-fade-in" style={{ zIndex: 1050, width: '90%', maxWidth: '320px' }}>
                        <div className="mb-3 text-primary">
                          <Icon name="save" size={48} />
                        </div>
                        <h5 className="fw-bold mb-2">Simpan Perubahan?</h5>
                        <p className="text-muted mb-4 text-sm">Apakah Anda yakin ingin menyimpan perubahan pada profil Anda?</p>
                        <div className="d-flex gap-2">
                          <button className="btn btn-light flex-grow-1 fw-bold" onClick={() => setShowConfirmSaveModal(false)}>Batal</button>
                          <button className="btn btn-primary flex-grow-1 fw-bold" onClick={handleConfirmSaveAccount}>Ya, Simpan</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'categories' && (
                <div className="animate-fade-in">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold mb-0"><Icon name="tag" size={18} className="me-2" />Manage Categories</h5>
                    <button className="btn btn-sm btn-primary d-flex align-items-center gap-1" onClick={() => setShowCatForm(!showCatForm)}>
                      <Icon name={showCatForm ? 'x' : 'plus-circle'} size={16} /> {showCatForm ? 'Cancel' : 'New'}
                    </button>
                  </div>

                  {showCatForm && (
                    <div className="card-trip mb-4 bg-light border">
                      <div className="card-body">
                        <div className="row g-2 align-items-end">
                          <div className="col-md-5">
                            <label className="form-label small">Name</label>
                            <input className="form-control form-control-sm" placeholder="e.g. Flight" value={catName} onChange={e => setCatName(e.target.value)} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small">Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input type="color" className="form-control form-control-color form-control-sm" value={catColor} onChange={e => setCatColor(e.target.value)} style={{ width: 40 }} />
                              <span className="small text-muted">{catColor}</span>
                            </div>
                          </div>
                          <div className="col-md-3">
                            <button className="btn btn-sm btn-primary w-100" onClick={handleCreateCategory}><Icon name="save" size={14} className="me-1" /> Save</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row g-3">
                    {categories.map(cat => (
                      <div key={cat.id} className="col-6 col-md-4">
                        <div className="card-trip text-center py-3 h-100 position-relative group-hover-show" style={{ borderTop: `4px solid ${cat.color}` }}>
                          <div className="card-body p-2 d-flex flex-column justify-content-center">
                            {editCatId === cat.id ? (
                              <div>
                                <input className="form-control form-control-sm text-center mb-2" value={editCatName} onChange={e => setEditCatName(e.target.value)} />
                                <div className="d-flex justify-content-center mb-2">
                                  <input type="color" className="form-control form-control-color form-control-sm" value={editCatColor} onChange={e => setEditCatColor(e.target.value)} />
                                </div>
                                <div className="d-flex gap-2 justify-content-center mt-3">
                                  <button className="btn btn-sm btn-light border text-secondary d-flex align-items-center justify-content-center p-0" style={{ width: '32px', height: '32px' }} onClick={() => setEditCatId(null)} title="Cancel">
                                    <Icon name="x" size={16} />
                                  </button>
                                  <button className="btn btn-sm btn-primary d-flex align-items-center justify-content-center p-0" style={{ width: '32px', height: '32px' }} onClick={() => handleUpdateCategory(cat.id)} title="Save">
                                    <Icon name="check" size={16} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40, backgroundColor: cat.color + '20' }}>
                                  <Icon name="tag" size={18} style={{ color: cat.color }} />
                                </div>
                                <h6 className="mb-0 small fw-bold">{cat.name}</h6>
                                {cat.owner !== 'default' && (
                                  <div className="d-flex gap-2 justify-content-center mt-3">
                                    <button className="btn btn-sm btn-light border text-primary d-flex align-items-center justify-content-center p-0" style={{ width: '32px', height: '32px' }} onClick={() => startEditCategory(cat)} title="Edit Category">
                                      <Icon name="edit" size={16} />
                                    </button>
                                    <button className="btn btn-sm btn-light border text-danger d-flex align-items-center justify-content-center p-0" style={{ width: '32px', height: '32px' }} onClick={() => { if(window.confirm('Delete category?')) deleteCategory(cat.id); }} title="Delete Category">
                                      <Icon name="trash" size={16} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                  <h5 className="fw-bold mb-4"><Icon name="monitor" size={18} className="me-2" />Appearance</h5>
                  
                  <div className="p-4 border rounded mb-3 bg-light">
                    <div className="mb-4">
                      <label className="form-label fw-bold text-muted mb-3"><Icon name="moon" size={16} className="me-2" />Tema Tampilan</label>
                      <div className="form-check form-switch d-flex align-items-center gap-2">
                        <input className="form-check-input mt-0 shadow-sm" type="checkbox" role="switch" id="darkModeSwitch" checked={darkMode} onChange={toggleDarkMode} style={{ width: '45px', height: '24px', cursor: 'pointer' }} />
                        <label className="form-check-label ms-2" htmlFor="darkModeSwitch" style={{ cursor: 'pointer', userSelect: 'none' }}>
                          {darkMode ? <span className="fw-bold">Dark Mode</span> : <span>Light Mode</span>}
                        </label>
                      </div>
                      <p className="text-muted small mt-2 mb-0">Ubah tampilan menjadi mode gelap agar lebih nyaman di mata saat malam hari.</p>
                    </div>

                    <hr className="my-4" />

                    <div className="mb-2">
                      <label className="form-label fw-bold text-muted mb-3"><Icon name="edit" size={16} className="me-2" />Warna Aksen Aplikasi</label>
                      <div className="d-flex gap-3 flex-wrap align-items-center">
                        {['#0ea5e9', '#10b981', '#8b5cf6', '#f43f5e', '#f97316', '#eab308'].map(color => (
                          <div 
                            key={color}
                            className={`rounded-circle cursor-pointer border ${themeColor === color ? 'shadow' : ''}`}
                            style={{ 
                              width: '40px', 
                              height: '40px', 
                              backgroundColor: color,
                              borderWidth: themeColor === color ? '3px !important' : '1px !important',
                              borderColor: themeColor === color ? 'var(--text-primary)' : 'var(--border)',
                              transform: themeColor === color ? 'scale(1.15)' : 'scale(1)',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onClick={() => setThemeColor(color)}
                            title={`Set theme to ${color}`}
                          />
                        ))}
                        
                        {/* Custom Color Picker */}
                        <div className="d-flex align-items-center justify-content-center rounded-circle border border-2 border-dashed position-relative overflow-hidden ms-2" 
                             style={{ width: '40px', height: '40px', backgroundColor: 'transparent', cursor: 'pointer', borderColor: 'var(--border) !important' }}
                             title="Pilih Warna Bebas">
                          <Icon name="plus" size={18} className="text-muted position-absolute" style={{ pointerEvents: 'none' }} />
                          <input 
                            type="color" 
                            className="position-absolute opacity-0 w-100 h-100" 
                            style={{ cursor: 'pointer', transform: 'scale(1.5)' }}
                            value={themeColor} 
                            onChange={(e) => setThemeColor(e.target.value)} 
                          />
                        </div>
                      </div>
                      <p className="text-muted small mt-3 mb-0">Personalisasikan warna utama aplikasi sesuai selera Anda.</p>
                    </div>

                    <hr className="my-4" />

                    <div className="mb-2">
                      <label className="form-label fw-bold text-muted mb-3"><Icon name="layout" size={16} className="me-2" />Warna Latar Belakang (Background)</label>
                      <div className="d-flex align-items-center gap-3">
                        <div className="d-flex align-items-center justify-content-center rounded border shadow-sm position-relative overflow-hidden" 
                             style={{ width: '48px', height: '48px', backgroundColor: bgColor || 'var(--bg-body)', cursor: 'pointer' }}
                             title="Pilih Warna Background">
                          <Icon name="edit-2" size={18} className="text-secondary position-absolute mix-blend-difference" style={{ pointerEvents: 'none' }} />
                          <input 
                            type="color" 
                            className="position-absolute opacity-0 w-100 h-100" 
                            style={{ cursor: 'pointer', transform: 'scale(1.5)' }}
                            value={bgColor || '#f8fafc'} 
                            onChange={(e) => setBgColor(e.target.value)} 
                          />
                        </div>
                        <div>
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => setBgColor('')} disabled={!bgColor}>
                            <Icon name="rotate-ccw" size={14} className="me-1" /> Reset ke Default
                          </button>
                        </div>
                      </div>
                      <p className="text-muted small mt-3 mb-0">Ubah warna latar belakang project sesuka hati Anda.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                  <h5 className="fw-bold mb-4"><Icon name="settings" size={18} className="me-2" />Preferensi Sistem</h5>
                  
                  <div className="p-3 border rounded mb-3">
                    <div className="mb-3">
                      <label className="form-label fw-bold small text-muted"><Icon name="globe" size={14} className="me-1" />Bahasa Aplikasi</label>
                      <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                        <option value="id">Bahasa Indonesia</option>
                        <option value="en">English (US)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                  <h5 className="fw-bold mb-4"><Icon name="info" size={18} className="me-2" />Tentang TripNan</h5>
                  {/* Tab Content */}
                  <div className="p-4 border rounded bg-light text-center">
                    {aboutTab === 'version' && (
                      <div className="animate-fade-in py-3">
                        <div className="rounded-circle mx-auto mb-3 bg-primary text-white d-flex align-items-center justify-content-center shadow-sm" style={{ width: 64, height: 64 }}>
                          <Icon name="map" size={32} />
                        </div>
                        <h4 className="fw-bold mb-1">TripNan</h4>
                        <p className="text-primary fw-bold mb-0">Version 2.0.0</p>
                        <p className="small text-muted mt-2">WebP Optimized & Responsive</p>
                      </div>
                    )}
                    
                    {aboutTab === 'kenali' && (
                      <div className="animate-fade-in text-start py-2">
                        <h6 className="fw-bold text-primary mb-3"><Icon name="info" size={18} className="me-2" />Kenali TripNan</h6>
                        <p className="small text-muted mb-0 lh-lg">
                          TripNan adalah aplikasi super-ringan untuk pencatatan dan manajemen perjalanan yang dirancang untuk memudahkan Anda merencanakan liburan, memantau anggaran (budget), serta mengelola aset perjalanan Anda secara mandiri.
                        </p>
                      </div>
                    )}
                    
                    {aboutTab === 'ulas' && (
                      <div className="animate-fade-in py-2">
                        <h6 className="fw-bold text-warning mb-3"><Icon name="star" size={18} className="me-2" />Ulas Aplikasi ini</h6>
                        <p className="small text-muted mb-3">Bagaimana pengalaman Anda menggunakan TripNan?</p>
                        <div className="d-flex gap-2 justify-content-center mb-4">
                          {[1, 2, 3, 4, 5].map(s => <Icon key={s} name="star" size={28} className="text-warning cursor-pointer" />)}
                        </div>
                        <button className="btn btn-sm btn-primary px-4"><Icon name="send" size={16} className="me-2" /> Kirim Ulasan</button>
                      </div>
                    )}
                  </div>
                  
                  <p className="small text-muted mt-5 text-center">© 2026 TripNan. All rights reserved.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Templates Page
const TemplatesPage = () => {
  const { templates, saveTemplate, deleteTemplate, useTemplate, activeTrip, navigateTo } = useTrip();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!activeTrip) return;
    await saveTemplate(name, desc, { name: activeTrip.name, schedules: activeTrip.schedules });
    setName('');
    setDesc('');
    setShow(false);
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('my-trips')}><Icon name="arrow-left" size={16} /> Back</button>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0"><Icon name="layout" size={24} /> Templates</h2>
        <button className="btn btn-primary" disabled={!activeTrip} onClick={() => setShow(!show)}><Icon name={show ? 'x' : 'plus'} size={18} /> {show ? 'Cancel' : 'Save Current'}</button>
      </div>
      {show && (
        <div className="card-trip mb-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">Save as Template</h5>
            <p className="text-muted small">Save "{activeTrip?.name}" for reuse</p>
            <div className="row g-3">
              <div className="col-md-6">
                <input className="form-control" placeholder="Template name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="col-md-4">
                <input className="form-control" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-primary" onClick={handleCreate}><Icon name="save" size={16} className="me-2" /> Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {templates.length === 0 ? (
        <div className="empty-state">
          <Icon name="layout" size={64} />
          <h4 className="fw-bold">No templates</h4>
          <p>Create a trip first, then save as template</p>
        </div>
      ) : (
        <div className="row g-4">
          {templates.map(t => (
            <div key={t.id} className="col-md-4">
              <div className="card-trip">
                <div className="card-body p-4">
                  <h5 className="fw-bold">{t.name}</h5>
                  <p className="text-muted small">{t.description || 'No description'}</p>
                  <small className="text-muted">{new Date(t.created_at).toLocaleDateString()}</small>
                  <div className="mt-3">
                    <button className="btn btn-sm btn-primary me-2" onClick={() => useTemplate(t.id)}><Icon name="play" size={14} className="me-1" /> Use</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteTemplate(t.id)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Notifications Page
const NotificationsPage = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, navigateTo } = useTrip();
  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0"><Icon name="bell" size={24} /> Notifications</h2>
        {notifications.some(n => !n.is_read) && (
          <button className="btn btn-sm btn-outline-primary" onClick={markAllNotificationsRead}><Icon name="check-circle" size={14} className="me-1" /> Mark all read</button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state">
          <Icon name="bell" size={64} />
          <h4 className="fw-bold">No notifications</h4>
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {notifications.map(n => (
            <div key={n.id} className={`card-trip ${!n.is_read ? '' : 'opacity-75'}`} onClick={() => !n.is_read && markNotificationRead(n.id)} style={{ cursor: 'pointer' }}>
              <div className="card-body p-3 d-flex align-items-center gap-3">
                <div className={`rounded-circle d-flex align-items-center justify-content-center ${n.is_read ? 'bg-light' : 'bg-primary'}`} style={{ width: 40, height: 40, color: n.is_read ? 'var(--text-muted)' : 'white' }}>
                  <Icon name={n.type === 'trip_shared' ? 'share-2' : 'info'} size={18} />
                </div>
                <div className="flex-grow-1">
                  <h6 className="mb-1">{n.title}</h6>
                  <p className="text-muted small mb-0">{n.message}</p>
                  <small className="text-muted">{new Date(n.created_at).toLocaleString('en-US')}</small>
                </div>
                {!n.is_read && <span className="rounded-circle bg-primary" style={{ width: 8, height: 8 }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------
// NEW COMPONENT: All Budgets Report
// ---------------------------------------------------------
const AllBudgetsReport = () => {
  const { trips } = useTrip();
  const [expandedTripId, setExpandedTripId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedTripId(prev => prev === id ? null : id);
  };
  
  const tripBudgets = trips.map(trip => {
    const schedules = trip.schedules || [];
    const totalPlan = parseFloat(trip.totalPlanBudget || 0);
    const totalReal = schedules.filter(s => s.isCompleted).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
    const itineraryReal = schedules.filter(s => s.isCompleted && !s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
    const addonReal = schedules.filter(s => s.isCompleted && s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
    
    const diff = totalReal - totalPlan;
    const isOver = diff > 0;
    
    return {
      id: trip.id,
      name: trip.name,
      totalPlan,
      totalReal,
      itineraryReal,
      addonReal,
      diff,
      isOver,
      hasSchedules: schedules.length > 0
    };
  });

  const overallPlan = tripBudgets.reduce((a, t) => a + t.totalPlan, 0);
  const overallReal = tripBudgets.reduce((a, t) => a + t.totalReal, 0);
  const overallDiff = overallReal - overallPlan;
  const overallIsOver = overallDiff > 0;

  return (
    <div className="animate-fade-in">
      <h2 className="fw-bold mb-4">All Budgets</h2>
      
      {/* Overall Summary Card */}
      <div className="card-trip mb-4 overflow-hidden border">
        <div className="card-body p-4 text-center border-bottom" style={{ background: overallIsOver ? 'linear-gradient(135deg, #fff, #fef2f2)' : 'linear-gradient(135deg, #fff, #f0fdf4)' }}>
          <h4 className="mb-3 text-muted">Overall Budget Status</h4>
          <h2 className={`fw-bold ${overallIsOver ? 'text-danger' : 'text-success'}`}>{overallIsOver ? 'OVER BUDGET' : 'ON BUDGET'}</h2>
          <p className="fs-5 text-muted mb-0">
            {overallIsOver ? <>Total Overspend <strong className="text-danger">Rp {overallDiff.toLocaleString('en-US')}</strong></> : <>Total Savings <strong className="text-success">Rp {Math.abs(overallDiff).toLocaleString('en-US')}</strong></>}
          </p>
        </div>
        <div className="card-body p-3">
          <div className="row text-center">
            <div className="col-6 border-end">
              <p className="text-muted small fw-bold mb-1">TOTAL BUDGET</p>
              <h5 className="fw-bold" style={{ color: 'var(--primary)' }}>Rp {overallPlan.toLocaleString('en-US')}</h5>
            </div>
            <div className="col-6">
              <p className="text-muted small fw-bold mb-1">TOTAL ACTUAL</p>
              <h5 className={`fw-bold ${overallIsOver ? 'text-danger' : 'text-success'}`}>Rp {overallReal.toLocaleString('en-US')}</h5>
            </div>
          </div>
        </div>
      </div>

      {/* List of Trip Budgets */}
      <h4 className="fw-bold mb-3">Trips Breakdown</h4>
      {tripBudgets.length === 0 ? (
        <div className="text-center text-muted py-5">
          <Icon name="folder" size={48} className="opacity-50 mb-3" />
          <p>No trips available.</p>
        </div>
      ) : (
        <div className="row g-3">
          {tripBudgets.map(trip => (
            <div className="col-12" key={trip.id}>
              <div className="card-trip border" style={{ borderLeft: `4px solid ${trip.isOver ? 'var(--bs-danger)' : 'var(--bs-success)'}` }}>
                {/* Header (Clickable) */}
                <div 
                  className="p-3 d-flex justify-content-between align-items-center" 
                  onClick={() => toggleExpand(trip.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <h5 className="fw-bold mb-0 text-truncate">{trip.name}</h5>
                  <Icon name={expandedTripId === trip.id ? 'chevron-up' : 'chevron-down'} size={20} className="text-muted" />
                </div>
                
                {/* Body (Expanded) */}
                {expandedTripId === trip.id && (
                  <div className="p-3 pt-0 border-top mt-2">
                    <div className="mt-3">
                      <div className="d-flex justify-content-between mb-2 small">
                        <span className="text-muted">Budget:</span>
                        <span className="fw-bold">Rp {trip.totalPlan.toLocaleString('en-US')}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2 small">
                        <span className="text-muted">Itinerary Spending:</span>
                        <span className="fw-medium">Rp {trip.itineraryReal.toLocaleString('en-US')}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2 small">
                        <span className="text-muted">Add-ons Spending:</span>
                        <span className="fw-medium">Rp {trip.addonReal.toLocaleString('en-US')}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2 small">
                        <span className="text-muted fw-bold">Total Actual:</span>
                        <span className={`fw-bold ${trip.isOver ? 'text-danger' : 'text-success'}`}>Rp {trip.totalReal.toLocaleString('en-US')}</span>
                      </div>
                      
                      <hr className="my-2" />
                      
                      <div className="d-flex justify-content-between align-items-center">
                        <span className={`badge ${trip.isOver ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                          {trip.isOver ? 'Over Budget' : 'On Budget'}
                        </span>
                        <span className={`small fw-bold ${trip.isOver ? 'text-danger' : 'text-success'}`}>
                          {trip.isOver ? '+' : '-'}Rp {Math.abs(trip.diff).toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Global Friends Page
const GlobalFriends = () => {
  const { globalFriends, searchUsers, addGlobalFriend, removeGlobalFriend } = useTrip();
  const [filter, setFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addStatus, setAddStatus] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setIsSearching(true);
    setAddStatus(null);
    const results = await searchUsers(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleAdd = async (username) => {
    setAddStatus({ loading: username });
    const res = await addGlobalFriend(username);
    if (res.success) {
      setAddStatus({ success: `Added ${username}` });
      setSearchResults(searchResults.filter(u => u.username !== username));
    } else {
      setAddStatus({ error: res.message });
    }
  };

  const handleRemove = async (id, e) => {
    e.stopPropagation();
    if (confirm('Remove this friend?')) {
      await removeGlobalFriend(id);
    }
  };

  const filteredFriends = globalFriends.filter(f => 
    f.username.toLowerCase().includes(filter.toLowerCase()) || 
    f.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="animate-fade-in p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">Friends</h2>
          <p className="text-muted mb-0">Your connected travel buddies</p>
        </div>
        <button className="btn btn-primary rounded-pill d-flex align-items-center gap-2" onClick={() => setShowAddModal(true)}>
          <Icon name="user-plus" size={18} /> <span className="d-none d-sm-inline">Find Friends</span>
        </button>
      </div>

      <div className="card-trip mb-4 p-2 d-flex align-items-center" style={{ borderRadius: '50px' }}>
        <Icon name="search" size={18} className="text-muted ms-3 me-2" />
        <input 
          type="text" 
          className="form-control border-0 bg-transparent shadow-none" 
          placeholder="Filter friends by username or email..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="row g-3">
        {filteredFriends.length === 0 ? (
          <div className="col-12 text-center py-5">
            <div className="d-flex align-items-center justify-content-center mx-auto mb-3 rounded-circle" style={{ width: 80, height: 80, background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
              <Icon name="users" size={40} />
            </div>
            <h5 className="fw-bold">No friends found</h5>
            <p className="text-muted">You haven't connected with anyone yet.</p>
          </div>
        ) : (
          filteredFriends.map(friend => (
            <div key={friend.relationship_id} className="col-12 col-md-6 col-lg-4">
              <div className="card-trip d-flex align-items-center p-3">
                <div className="avatar me-3 bg-primary text-white d-flex align-items-center justify-content-center fw-bold fs-5 rounded-circle" style={{ width: 50, height: 50 }}>
                  {friend.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-grow-1">
                  <h6 className="fw-bold mb-0">{friend.username}</h6>
                  <p className="text-muted small mb-0">{friend.email}</p>
                </div>
                <button className="btn btn-outline-danger btn-sm rounded-circle p-2" onClick={(e) => handleRemove(friend.relationship_id, e)} title="Remove Friend">
                  <Icon name="user-minus" size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 1050 }}>
          <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={() => setShowAddModal(false)}></div>
          <div className="card-trip position-relative p-4 w-100" style={{ zIndex: 1050, maxWidth: '500px', margin: '20px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-bold mb-0">Find Friends</h4>
              <button className="btn p-0 text-muted" onClick={() => setShowAddModal(false)}><Icon name="x" size={24} /></button>
            </div>
            
            <form onSubmit={handleSearch} className="mb-4 d-flex gap-2">
              <input 
                type="text" 
                className="form-control" 
                placeholder="Enter username or email..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={isSearching}>
                {isSearching ? <span className="spinner-border spinner-border-sm"></span> : <Icon name="search" size={18} />}
              </button>
            </form>

            {addStatus?.success && <div className="alert alert-success py-2">{addStatus.success}</div>}
            {addStatus?.error && <div className="alert alert-danger py-2">{addStatus.error}</div>}

            <div className="search-results" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {searchResults.length === 0 && !isSearching && searchQuery && (
                <p className="text-muted text-center py-3">No users found.</p>
              )}
              {searchResults.map(user => (
                <div key={user.username} className="d-flex align-items-center justify-content-between p-3 border-bottom border-light">
                  <div className="d-flex align-items-center gap-3">
                    <div className="avatar bg-secondary text-white d-flex align-items-center justify-content-center fw-bold rounded-circle" style={{ width: 40, height: 40 }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="fw-bold">{user.username}</div>
                      <div className="text-muted small">{user.email}</div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-sm btn-outline-primary rounded-pill px-3 d-flex align-items-center gap-1 fw-medium" 
                    onClick={() => handleAdd(user.username)}
                    disabled={addStatus?.loading === user.username}
                  >
                    {addStatus?.loading === user.username ? <><span className="spinner-border spinner-border-sm"></span> Adding</> : <><Icon name="user-plus" size={14} /> Add</>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// App Content
const AppContent = () => {
  const { currentUser, activeView, navigateTo, logout, unreadCount } = useTrip();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Handle navigation
  const handleNavClick = (key) => {
    navigateTo(key);
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  };

  if (!currentUser) return <AuthPage />;

  const pages = {
    'my-trips': <MyTrips />,
    'trip-dashboard': <TripDashboard />,
    itinerary: <Itinerary />,
    addons: <AddOns />,
    friends: <Friends />,
    budget: <BudgetReport />,
    settings: <SettingsPage />,
    templates: <TemplatesPage />,
    notifications: <NotificationsPage />,
    'all-budgets': <AllBudgetsReport />,
    'global-friends': <GlobalFriends />
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Header */}
      <div 
        className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white sticky-top shadow-sm" 
        style={{ 
          zIndex: 1030, 
          transition: 'top 0.3s ease-in-out', 
          top: showHeader ? '0' : '-100px' 
        }}
      >
        <div className="d-flex align-items-center">
          <button onClick={toggleSidebar} className="btn p-2 me-2 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center">
            <Icon name="menu" size={24} />
          </button>
          <div className="fw-bold fs-5 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
            <Icon name="map" size={24} /> TripNan
          </div>
        </div>
        <div className="d-flex align-items-center gap-1 ms-auto">

          <button className="btn p-2 border-0 bg-transparent text-primary position-relative d-flex align-items-center justify-content-center" onClick={() => { navigateTo('notifications'); closeSidebar(); }} title="Notifications">
            <Icon name="bell" size={22} />
            {unreadCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.6rem', padding: '0.25em 0.4em', transform: 'translate(-60%, 20%)' }}>{unreadCount}</span>}
          </button>
          <button className="btn p-2 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center" onClick={logout} title="Logout">
            <Icon name="log-out" size={22} />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile only) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="d-flex align-items-center justify-content-between mb-4 d-md-none">
          <div className="fw-bold fs-5 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
            <Icon name="map" size={24} /> TripNan
          </div>
          <button className="btn p-1 border-0 bg-transparent text-muted" onClick={closeSidebar}>
            <Icon name="x" size={24} />
          </button>
        </div>
        
        <nav className="sidebar-nav pt-1">
          <div className="sidebar-group-title text-muted small fw-bold px-3 mb-2 text-uppercase">Dashboard</div>
          {[
            { key: 'my-trips', icon: 'map', label: 'My Trips' },
            { key: 'all-budgets', icon: 'dollar-sign', label: 'All Budgets' },
            { key: 'global-friends', icon: 'users', label: 'Friends' }
          ].map(item => (
            <button
              key={item.key}
              className={`sidebar-nav-item ${activeView === item.key ? 'active' : ''}`}
              onClick={() => handleNavClick(item.key)}
            >
              <Icon name={item.icon} size={18} /> {item.label}
              {item.badge > 0 && <span className="sidebar-badge">{item.badge}</span>}
            </button>
          ))}
          
          <div className="sidebar-group-title text-muted small fw-bold px-3 mb-2 mt-4 text-uppercase">Management</div>
          {[
            { key: 'templates', icon: 'layout', label: 'Templates' }
          ].map(item => (
            <button
              key={item.key}
              className={`sidebar-nav-item ${activeView === item.key ? 'active' : ''}`}
              onClick={() => handleNavClick(item.key)}
            >
              <Icon name={item.icon} size={18} /> {item.label}
              {item.badge > 0 && <span className="sidebar-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-user-card mt-auto d-flex flex-column gap-2" style={{ marginBottom: 0 }}>
          <div className="d-flex align-items-center gap-3">
            <div className="sidebar-user-avatar">{currentUser?.charAt(0).toUpperCase()}</div>
            <div>
              <p className="small mb-0" style={{ color: 'var(--text-muted)' }}>Logged in as</p>
              <p className="fw-bold mb-0" style={{ color: 'var(--text-primary)' }}>{currentUser}</p>
            </div>
          </div>
          <button 
            className={`btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2 ${activeView === 'settings' ? 'btn-primary' : 'btn-light border'}`} 
            onClick={() => handleNavClick('settings')}
          >
            <Icon name="settings" size={16} /> Settings
          </button>
          {!/wv/i.test(navigator.userAgent) && (
            <a 
              href="/app-release.apk" 
              className="btn btn-sm btn-primary w-100 d-flex align-items-center justify-content-center gap-2 mt-2 shadow-sm" 
              download
              title="Download Android App"
            >
              <Icon name="smartphone" size={16} /> Download App
            </a>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content d-flex flex-column flex-grow-1">
        <div className="px-3 px-md-5 pt-3 pt-md-4 pb-5 flex-grow-1">
          {pages[activeView] || <MyTrips />}
        </div>
        
        {/* Footer Section */}
        <div className="mt-auto">

          <footer className="text-center text-muted py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <small>&copy; {new Date().getFullYear()} Dnan Dev. All rights reserved.</small>
          </footer>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <TripProvider>
    <AppContent />
  </TripProvider>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
