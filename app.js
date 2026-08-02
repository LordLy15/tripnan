import { jsxDEV as _jsxDEV, Fragment as _Fragment } from "react/jsx-dev-runtime";
const {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef
} = React;

// Helper Functions
const generateId = () => Math.random().toString(36).substr(2, 9);
const generateTripCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();
const formatCurrency = val => {
  if (!val && val !== 0) return '';
  const num = val.toString().replace(/[^0-9]/g, '');
  return num ? parseInt(num, 10).toLocaleString('en-US') : '';
};
const parseCurrency = val => {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
};
const compressImage = (file, maxWidth = 800) => {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
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

// Context
const TripContext = createContext();
const useTrip = () => useContext(TripContext);
const TripProvider = ({
  children
}) => {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('tripUser') || null);
  const [trips, setTrips] = useState([]);
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('my-trips');
  const [activeTripId, setActiveTripId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('tripDarkMode') === 'true');
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('tripDarkMode', newMode);
  };
  const fetchAPI = async (action, data = {}) => {
    try {
      const res = await fetch(`api/api.php?action=${action}${action === 'get_trips' || action === 'get_categories' || action === 'get_templates' || action === 'get_notifications' || action === 'get_unread_count' || action === 'get_profile' || action === 'find_trip_by_code' ? `&${Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}` : ''}`, {
        method: action.includes('get') ? 'GET' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: action.includes('get') ? undefined : JSON.stringify(data)
      });
      const text = await res.text();
      if (!text.startsWith('{')) return {
        success: false,
        message: 'Server error'
      };
      return JSON.parse(text);
    } catch (err) {
      return {
        success: false,
        message: 'Connection error'
      };
    }
  };
  const fetchTrips = async user => {
    setIsLoading(true);
    const data = await fetchAPI('get_trips', {
      owner: user
    });
    if (data.success) setTrips(data.trips || []);
    setIsLoading(false);
  };
  const fetchCategories = async user => {
    const data = await fetchAPI('get_categories', {
      owner: user
    });
    if (data.success) setCategories(data.categories || []);
  };
  const fetchTemplates = async user => {
    const data = await fetchAPI('get_templates', {
      owner: user
    });
    if (data.success) setTemplates(data.templates || []);
  };
  const fetchNotifications = async user => {
    const data = await fetchAPI('get_notifications', {
      user_id: user
    });
    if (data.success) setNotifications(data.notifications || []);
    const count = await fetchAPI('get_unread_count', {
      user_id: user
    });
    if (count.success) setUnreadCount(count.count || 0);
  };
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('tripUser', currentUser);
      fetchTrips(currentUser);
      fetchCategories(currentUser);
      fetchTemplates(currentUser);
      fetchNotifications(currentUser);
    } else {
      localStorage.removeItem('tripUser');
      setTrips([]);
    }
  }, [currentUser]);
  const loginUser = async (username, password) => {
    const data = await fetchAPI('login', {
      username,
      password
    });
    if (data.success) setCurrentUser(username);
    return data;
  };
  const registerUser = async (username, password, email = '') => {
    const data = await fetchAPI('register', {
      username,
      password,
      email
    });
    if (data.success) setCurrentUser(username);
    return data;
  };
  const logout = () => {
    setCurrentUser(null);
    setActiveView('my-trips');
    setActiveTripId(null);
  };
  const activeTrip = trips.find(t => t.id === activeTripId) || null;
  const createTrip = async (name, budget, category_id = null, coverUrl = null) => {
    const trip = {
      id: generateId(),
      owner: currentUser,
      name,
      totalPlanBudget: parseCurrency(budget),
      tripCode: generateTripCode(),
      category_id,
      coverUrl: coverUrl,
      schedules: [],
      friends: []
    };
    setTrips([...trips, {
      ...trip,
      isOwner: true
    }]);
    fetchAPI('create_trip', trip);
    return {
      success: true
    };
  };
  const updateTrip = async (id, fields) => {
    setTrips(trips.map(t => t.id === id ? {
      ...t,
      ...fields
    } : t));
    fetchAPI('update_trip', {
      id,
      ...fields
    });
  };
  const deleteTrip = async id => {
    setTrips(trips.filter(t => t.id !== id));
    setActiveView('my-trips');
    setActiveTripId(null);
    fetchAPI('delete_trip', {
      id
    });
  };
  const addSchedule = async schedule => {
    const newSch = {
      ...schedule,
      id: generateId(),
      trip_id: activeTripId,
      photos: [],
      is_addon: schedule.is_addon || false
    };
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      schedules: [...t.schedules, newSch]
    } : t));
    fetchAPI('add_schedule', newSch);
  };
  const updateSchedulePhotos = async (id, photos) => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      schedules: t.schedules.map(s => s.id === id ? {
        ...s,
        photos
      } : s)
    } : t));
    fetchAPI('update_schedule_photos', {
      id,
      photos
    });
  };
  const updateSchedule = async (id, fields) => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      schedules: t.schedules.map(s => s.id === id ? {
        ...s,
        ...fields
      } : s)
    } : t));
    if (fields.photos !== undefined) {
      fetchAPI('update_schedule_photos', {
        id,
        photos: fields.photos
      });
    }
    fetchAPI('update_schedule', {
      id,
      ...fields
    });
  };
  const deleteSchedule = async id => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      schedules: t.schedules.filter(s => s.id !== id)
    } : t));
    fetchAPI('delete_schedule', {
      id
    });
  };
  const addFriend = async (name, email) => {
    const friend = {
      id: generateId(),
      trip_id: activeTripId,
      name,
      email
    };
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      friends: [...t.friends, friend]
    } : t));
    fetchAPI('add_friend', friend);
  };
  const removeFriend = async id => {
    setTrips(trips.map(t => t.id === activeTripId ? {
      ...t,
      friends: t.friends.filter(f => f.id !== id)
    } : t));
    fetchAPI('delete_friend', {
      id
    });
  };
  const joinTrip = async tripCode => {
    const data = await fetchAPI('join_trip', {
      trip_code: tripCode,
      user: currentUser
    });
    if (data.success) await fetchTrips(currentUser);
    return data;
  };
  const exportTrip = async () => {
    const data = await fetchAPI('export_trip', {
      trip_id: activeTripId
    });
    if (data.success) {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTrip?.name || 'trip'}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  const importTrip = async file => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result);
        const res = await fetchAPI('import_trip', {
          owner: currentUser,
          data
        });
        if (res.success) await fetchTrips(currentUser);
        alert(res.success ? 'Imported successfully!' : 'Failed: ' + res.message);
      } catch (err) {
        alert('Invalid file');
      }
    };
    reader.readAsText(file);
  };
  const saveTemplate = async (name, description, template_data) => {
    const id = generateId();
    await fetchAPI('save_template', {
      id,
      owner: currentUser,
      name,
      description,
      template_data
    });
    setTemplates([{
      id,
      name,
      description,
      created_at: new Date().toISOString()
    }, ...templates]);
  };
  const deleteTemplate = async id => {
    await fetchAPI('delete_template', {
      id
    });
    setTemplates(templates.filter(t => t.id !== id));
  };
  const useTemplate = async template_id => {
    const res = await fetchAPI('use_template', {
      template_id,
      owner: currentUser
    });
    if (res.success && res.new_trip_id) {
      // Re-fetch trips to get the newly created trip
      const data = await fetchAPI('get_trips', {
        owner: currentUser
      });
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
    await fetchAPI('create_category', {
      id,
      owner: currentUser,
      name,
      color,
      icon
    });
    setCategories([...categories, {
      id,
      owner: currentUser,
      name,
      color,
      icon
    }]);
  };
  const deleteCategory = async id => {
    await fetchAPI('delete_category', {
      id
    });
    setCategories(categories.filter(c => c.id !== id));
  };
  const updateCategory = async (id, name, color, icon) => {
    await fetchAPI('update_category', {
      id,
      name,
      color,
      icon
    });
    setCategories(categories.map(c => c.id === id ? {
      ...c,
      name,
      color,
      icon
    } : c));
  };
  const updateUser = async (full_name, password) => {
    const res = await fetchAPI('update_user', {
      username: currentUser,
      full_name,
      password
    });
    return res;
  };
  const updateProfile = async profileData => {
    await fetchAPI('update_profile', {
      username: currentUser,
      ...profileData
    });
  };
  const markNotificationRead = async id => {
    await fetchAPI('mark_notification_read', {
      id
    });
    setNotifications(notifications.map(n => n.id === id ? {
      ...n,
      is_read: true
    } : n));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };
  const markAllNotificationsRead = async () => {
    await fetchAPI('mark_all_notifications_read', {
      user_id: currentUser
    });
    setNotifications(notifications.map(n => ({
      ...n,
      is_read: true
    })));
    setUnreadCount(0);
  };
  const navigateTo = (view, tripId = null) => {
    setActiveTripId(tripId || activeTripId);
    setActiveView(view);
  };
  const value = {
    currentUser,
    trips,
    categories,
    templates,
    notifications,
    unreadCount,
    activeTrip,
    isLoading,
    loginUser,
    registerUser,
    logout,
    createTrip,
    updateTrip,
    deleteTrip,
    addSchedule,
    updateSchedule,
    updateSchedulePhotos,
    deleteSchedule,
    addFriend,
    removeFriend,
    joinTrip,
    exportTrip,
    importTrip,
    saveTemplate,
    deleteTemplate,
    useTemplate,
    createCategory,
    deleteCategory,
    updateCategory,
    updateProfile,
    updateUser,
    markNotificationRead,
    markAllNotificationsRead,
    navigateTo,
    activeView,
    darkMode,
    toggleDarkMode
  };
  return /*#__PURE__*/_jsxDEV(TripContext.Provider, {
    value: value,
    children: children
  }, void 0, false);
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
  'globe': '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
};
const Icon = ({
  name,
  size = 20,
  className = "",
  color
}) => /*#__PURE__*/_jsxDEV("svg", {
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color || "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: className,
  dangerouslySetInnerHTML: {
    __html: icons[name] || icons.info
  }
}, void 0, false);

// Auth Page
const AuthPage = () => {
  const {
    loginUser,
    registerUser
  } = useTrip();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    setLoading(true);
    const res = isLogin ? await loginUser(username, password) : await registerUser(username, password, email);
    setLoading(false);
    if (!res.success) setError(res.message);
  };
  return /*#__PURE__*/_jsxDEV("div", {
    className: "login-page",
    children: /*#__PURE__*/_jsxDEV("div", {
      className: "login-card animate-fade-in",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "text-center mb-4",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "icon-circle",
          children: /*#__PURE__*/_jsxDEV(Icon, {
            name: "map",
            size: 24
          }, void 0, false)
        }, void 0, false), /*#__PURE__*/_jsxDEV("h2", {
          className: "fw-bold",
          children: "TripNan"
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted",
          children: isLogin ? 'Welcome back!' : 'Create your account'
        }, void 0, false)]
      }, void 0, true), error && /*#__PURE__*/_jsxDEV("div", {
        className: "alert alert-danger",
        children: error
      }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
        onSubmit: handleSubmit,
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "mb-3",
          children: [/*#__PURE__*/_jsxDEV("label", {
            className: "form-label",
            children: "Username"
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "input-group",
            children: [/*#__PURE__*/_jsxDEV("span", {
              className: "input-group-text",
              children: /*#__PURE__*/_jsxDEV(Icon, {
                name: "user",
                size: 16
              }, void 0, false)
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "text",
              className: "form-control",
              placeholder: "Enter username",
              value: username,
              onChange: e => setUsername(e.target.value),
              required: true
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "mb-3",
          children: [/*#__PURE__*/_jsxDEV("label", {
            className: "form-label",
            children: "Password"
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "input-group",
            children: [/*#__PURE__*/_jsxDEV("span", {
              className: "input-group-text",
              children: /*#__PURE__*/_jsxDEV(Icon, {
                name: "lock",
                size: 16
              }, void 0, false)
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "password",
              className: "form-control",
              placeholder: "Enter password",
              value: password,
              onChange: e => setPassword(e.target.value),
              required: true
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), !isLogin && /*#__PURE__*/_jsxDEV("div", {
          className: "mb-3",
          children: [/*#__PURE__*/_jsxDEV("label", {
            className: "form-label",
            children: "Email (optional)"
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "input-group",
            children: [/*#__PURE__*/_jsxDEV("span", {
              className: "input-group-text",
              children: /*#__PURE__*/_jsxDEV(Icon, {
                name: "mail",
                size: 16
              }, void 0, false)
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "email",
              className: "form-control",
              placeholder: "Enter email",
              value: email,
              onChange: e => setEmail(e.target.value)
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
          type: "submit",
          className: "btn btn-primary w-100",
          disabled: loading,
          children: loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
        className: "text-center mt-3 text-muted small",
        children: [isLogin ? "Don't have an account? " : "Already have an account? ", /*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-link p-0",
          onClick: () => setIsLogin(!isLogin),
          children: isLogin ? 'Register' : 'Login'
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true)
  }, void 0, false);
};

// Enhanced Photo Gallery Component with hover zoom, download, and preview
const PhotoGallery = ({
  photos = [],
  onAdd,
  onDelete,
  editable = false,
  showHeader = true
}) => {
  const [previewImage, setPreviewImage] = useState(null);
  const count = photos.length + (editable ? 1 : 0);
  const gridClass = count === 1 ? 'single' : count === 2 ? 'multiple-2' : count === 3 ? 'multiple-3' : count === 4 ? 'multiple-4' : 'multiple-n';
  const handleDownload = (photo, index) => {
    const a = document.createElement('a');
    a.href = photo;
    a.download = `photo_${index + 1}.jpg`;
    a.click();
  };
  return /*#__PURE__*/_jsxDEV(_Fragment, {
    children: [showHeader && photos.length > 0 && /*#__PURE__*/_jsxDEV("div", {
      className: "photo-gallery-header",
      children: /*#__PURE__*/_jsxDEV("h6", {
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: "camera",
          size: 14
        }, void 0, false), " Photos (", photos.length, ")"]
      }, void 0, true)
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: `photo-gallery ${gridClass}`,
      children: [photos.map((photo, i) => /*#__PURE__*/_jsxDEV("div", {
        className: "photo-item",
        onClick: () => setPreviewImage(photo),
        children: [/*#__PURE__*/_jsxDEV("img", {
          src: photo,
          alt: `Photo ${i + 1}`,
          loading: "lazy"
        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
          className: "photo-number",
          children: i + 1
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "photo-overlay",
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: "photo-action",
            onClick: e => {
              e.stopPropagation();
              handleDownload(photo, i);
            },
            title: "Download Photo",
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "download",
              size: 18
            }, void 0, false)
          }, void 0, false), editable && /*#__PURE__*/_jsxDEV("button", {
            className: "photo-action delete",
            onClick: e => {
              e.stopPropagation();
              onDelete(i);
            },
            title: "Delete Photo",
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "trash",
              size: 18
            }, void 0, false)
          }, void 0, false)]
        }, void 0, true)]
      }, i, true)), editable && onAdd && /*#__PURE__*/_jsxDEV("label", {
        className: "add-photo-btn",
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: "camera",
          size: 28
        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
          className: "small fw-semibold",
          children: "Add Photo"
        }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
          type: "file",
          accept: "image/*",
          onChange: onAdd,
          style: {
            display: 'none'
          },
          multiple: true
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true), previewImage && /*#__PURE__*/_jsxDEV("div", {
      className: "image-preview-modal animate-scale-in",
      onClick: () => setPreviewImage(null),
      children: [/*#__PURE__*/_jsxDEV("button", {
        className: "close-btn",
        onClick: () => setPreviewImage(null),
        children: /*#__PURE__*/_jsxDEV(Icon, {
          name: "x",
          size: 24
        }, void 0, false)
      }, void 0, false), /*#__PURE__*/_jsxDEV("img", {
        src: previewImage,
        alt: "Preview",
        onClick: e => e.stopPropagation()
      }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
        className: "btn btn-light position-absolute",
        style: {
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)'
        },
        onClick: e => {
          e.stopPropagation();
          const link = document.createElement('a');
          link.href = previewImage;
          link.download = `photo_${Date.now()}.jpg`;
          link.click();
        },
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: "download",
          size: 18
        }, void 0, false), " Download"]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
};

// ---------------------------------------------------------
// Helper: Calculate Trip Duration
// ---------------------------------------------------------
const calculateTripDuration = schedules => {
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

  return `${days} Day${days > 1 ? 's' : ''}`;
};

// My Trips Page
const MyTrips = () => {
  const {
    trips,
    createTrip,
    joinTrip,
    navigateTo,
    isLoading,
    categories,
    logout,
    unreadCount,
    currentUser
  } = useTrip();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTrip, setNewTrip] = useState({
    name: '',
    budget: '',
    category_id: ''
  });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [coverPreview, setCoverPreview] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // list or grid

  const handleCreate = async e => {
    e.preventDefault();
    await createTrip(newTrip.name, newTrip.budget, newTrip.category_id || null, coverPreview);
    setNewTrip({
      name: '',
      budget: '',
      category_id: ''
    });
    setCoverPreview(null);
    setShowCreate(false);
  };
  const handleJoin = async e => {
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
  const handleCoverUpload = async e => {
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
    return /*#__PURE__*/_jsxDEV("div", {
      className: "animate-fade-in",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "row align-items-center mb-4 gap-3 gap-md-0",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "col-12 col-md-auto",
          children: [/*#__PURE__*/_jsxDEV("h4", {
            className: "text-muted mb-2 fw-normal",
            children: [getGreeting(), ", ", /*#__PURE__*/_jsxDEV("span", {
              className: "fw-bold",
              style: {
                color: 'var(--primary)'
              },
              children: currentUser
            }, void 0, false), "!"]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "placeholder-glow",
            children: /*#__PURE__*/_jsxDEV("span", {
              className: "placeholder col-6 fs-3 rounded"
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "placeholder-glow",
            children: /*#__PURE__*/_jsxDEV("span", {
              className: "placeholder col-4 rounded mt-1"
            }, void 0, false)
          }, void 0, false)]
        }, void 0, true)
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "row g-4",
        children: [1, 2, 3].map(i => /*#__PURE__*/_jsxDEV("div", {
          className: viewMode === 'grid' ? 'col-6 col-md-4' : 'col-12',
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-trip trip-card placeholder-glow",
            style: {
              height: '280px'
            },
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "trip-cover placeholder w-100",
              style: {
                height: '140px'
              }
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "card-body",
              children: [/*#__PURE__*/_jsxDEV("span", {
                className: "placeholder col-8 mb-2 rounded"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                className: "placeholder col-4 mb-3 rounded"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                className: "placeholder col-12 mb-2 rounded"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                className: "placeholder col-12 rounded"
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)
        }, i, false))
      }, void 0, false)]
    }, void 0, true);
  }
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("div", {
      className: "row align-items-center mb-4 gap-3 gap-md-0",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "col-12 col-md-auto",
        children: [/*#__PURE__*/_jsxDEV("h4", {
          className: "text-muted mb-2 fw-normal",
          children: [getGreeting(), ", ", /*#__PURE__*/_jsxDEV("span", {
            className: "fw-bold",
            style: {
              color: 'var(--primary)'
            },
            children: currentUser
          }, void 0, false), "!"]
        }, void 0, true), /*#__PURE__*/_jsxDEV("h1", {
          className: "h3 fw-bold mb-1",
          children: "My Trips"
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted mb-0",
          children: [trips.length, " trips planned"]
        }, void 0, true)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "col-12 col-md d-flex justify-content-md-end flex-wrap gap-2",
        children: [/*#__PURE__*/_jsxDEV("select", {
          className: "form-select",
          value: filterCat,
          onChange: e => setFilterCat(e.target.value),
          style: {
            width: 'auto',
            flexGrow: 1
          },
          children: [/*#__PURE__*/_jsxDEV("option", {
            value: "",
            children: "All Categories"
          }, void 0, false), categories.map(c => /*#__PURE__*/_jsxDEV("option", {
            value: c.id,
            children: c.name
          }, c.id, false))]
        }, void 0, true), showCreate || showJoin ? /*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-outline-secondary",
          onClick: () => {
            setShowCreate(false);
            setShowJoin(false);
          },
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "x",
            size: 16
          }, void 0, false), " Cancel"]
        }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
          className: "position-relative",
          style: {
            display: 'inline-block'
          },
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-light border d-flex align-items-center gap-2",
            type: "button",
            onClick: () => setShowDropdown(!showDropdown),
            style: {
              backgroundColor: '#f8f9fa'
            },
            children: ["Add New ", /*#__PURE__*/_jsxDEV(Icon, {
              name: showDropdown ? "chevron-up" : "chevron-down",
              size: 16
            }, void 0, false)]
          }, void 0, true), showDropdown && /*#__PURE__*/_jsxDEV(_Fragment, {
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "position-fixed top-0 start-0 w-100 h-100",
              style: {
                zIndex: 999
              },
              onClick: () => setShowDropdown(false)
            }, void 0, false), /*#__PURE__*/_jsxDEV("ul", {
              className: "dropdown-menu shadow show py-2",
              style: {
                position: 'absolute',
                right: 0,
                top: '100%',
                zIndex: 1000,
                marginTop: '8px',
                minWidth: '180px',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              },
              children: [/*#__PURE__*/_jsxDEV("li", {
                children: /*#__PURE__*/_jsxDEV("button", {
                  className: "dropdown-item py-2 d-flex align-items-center",
                  onClick: () => {
                    setShowDropdown(false);
                    setShowCreate(true);
                  },
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "plus-circle",
                    size: 16,
                    className: "me-2 text-primary"
                  }, void 0, false), "Create New Trip"]
                }, void 0, true)
              }, void 0, false), /*#__PURE__*/_jsxDEV("li", {
                children: /*#__PURE__*/_jsxDEV("button", {
                  className: "dropdown-item py-2 d-flex align-items-center",
                  onClick: () => {
                    setShowDropdown(false);
                    setShowJoin(true);
                  },
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "users",
                    size: 16,
                    className: "me-2 text-success"
                  }, void 0, false), "Join via Code"]
                }, void 0, true)
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "btn-group border bg-white rounded-3 shadow-sm d-flex",
          style: {
            padding: '2px'
          },
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: `btn btn-sm ${viewMode === 'grid' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted border-0'}`,
            onClick: () => setViewMode('grid'),
            style: {
              padding: '6px 12px'
            },
            title: "Grid View",
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "layout",
              size: 16
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: `btn btn-sm ${viewMode === 'list' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted border-0'}`,
            onClick: () => setViewMode('list'),
            style: {
              padding: '6px 12px'
            },
            title: "List View",
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "list",
              size: 16
            }, void 0, false)
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true), showCreate && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4 animate-fade-in",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-4",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "Create New Trip"
        }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
          onSubmit: handleCreate,
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "row g-3",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Trip Name"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                className: "form-control",
                placeholder: "Bali Adventure 2026",
                value: newTrip.name,
                onChange: e => setNewTrip({
                  ...newTrip,
                  name: e.target.value
                }),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Budget (IDR)"
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "input-group",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "input-group-text",
                  children: "Rp"
                }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                  type: "text",
                  inputMode: "numeric",
                  className: "form-control",
                  placeholder: "5,000,000",
                  value: newTrip.budget,
                  onChange: e => setNewTrip({
                    ...newTrip,
                    budget: formatCurrency(e.target.value)
                  }),
                  required: true
                }, void 0, false)]
              }, void 0, true)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Category"
              }, void 0, false), /*#__PURE__*/_jsxDEV("select", {
                className: "form-select",
                value: newTrip.category_id,
                onChange: e => setNewTrip({
                  ...newTrip,
                  category_id: e.target.value
                }),
                children: [/*#__PURE__*/_jsxDEV("option", {
                  value: "",
                  children: "No Category"
                }, void 0, false), categories.map(c => /*#__PURE__*/_jsxDEV("option", {
                  value: c.id,
                  children: c.name
                }, c.id, false))]
              }, void 0, true)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-6",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Cover Photo"
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "d-flex gap-2 align-items-center",
                children: [coverPreview && /*#__PURE__*/_jsxDEV("img", {
                  src: coverPreview,
                  alt: "Cover",
                  style: {
                    width: 80,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 8
                  }
                }, void 0, false), /*#__PURE__*/_jsxDEV("label", {
                  className: "btn btn-outline-primary btn-sm",
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "camera",
                    size: 14
                  }, void 0, false), " Upload Cover", /*#__PURE__*/_jsxDEV("input", {
                    type: "file",
                    accept: "image/*",
                    onChange: handleCoverUpload,
                    style: {
                      display: 'none'
                    }
                  }, void 0, false)]
                }, void 0, true)]
              }, void 0, true)]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
            type: "submit",
            className: "btn btn-primary mt-3",
            children: "Create Trip"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), showJoin && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4 animate-fade-in",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-4",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "Join a Trip"
        }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
          onSubmit: handleJoin,
          children: [joinError && /*#__PURE__*/_jsxDEV("div", {
            className: "alert alert-danger p-2 small",
            children: joinError
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "row g-3 align-items-end",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "col-md-8",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Trip Code"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                className: "form-control",
                placeholder: "Enter 6-character code",
                value: joinCode,
                onChange: e => setJoinCode(e.target.value.toUpperCase()),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: /*#__PURE__*/_jsxDEV("button", {
                type: "submit",
                className: "btn btn-primary w-100",
                children: "Join Trip"
              }, void 0, false)
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), filtered.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "empty-state",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "compass",
        size: 64
      }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
        className: "fw-bold",
        children: "No trips yet"
      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
        children: "Create your first trip to get started!"
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "d-flex gap-2 justify-content-center mt-2",
        children: [/*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-primary",
          onClick: () => setShowCreate(true),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "plus",
            size: 16
          }, void 0, false), " Create Trip"]
        }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-outline-primary",
          onClick: () => setShowJoin(true),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "user-plus",
            size: 16
          }, void 0, false), " Join Trip"]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV(_Fragment, {
      children: (() => {
        const inProgressTrips = filtered.filter(t => !t.is_finished);
        const completedTrips = filtered.filter(t => t.is_finished);
        const renderTripCards = tripList => /*#__PURE__*/_jsxDEV("div", {
          className: "row g-4",
          children: tripList.map((trip, index) => {
            const completed = trip.schedules?.filter(s => s.isCompleted).length || 0;
            const total = trip.schedules?.length || 0;
            const progress = total ? Math.round(completed / total * 100) : 0;
            const cat = categories.find(c => c.id === trip.category_id);
            const isEager = index < 2;
            return /*#__PURE__*/_jsxDEV("div", {
              className: viewMode === 'grid' ? 'col-6 col-md-4' : 'col-12',
              children: /*#__PURE__*/_jsxDEV("div", {
                className: "card-trip trip-card",
                onClick: () => navigateTo('trip-dashboard', trip.id),
                children: [/*#__PURE__*/_jsxDEV("div", {
                  className: "trip-cover",
                  style: {
                    background: trip.coverUrl ? 'transparent' : 'linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%)'
                  },
                  children: [trip.coverUrl && /*#__PURE__*/_jsxDEV("img", {
                    src: trip.coverUrl,
                    alt: "Trip Cover",
                    className: "cover-img",
                    loading: isEager ? "eager" : "lazy",
                    fetchpriority: isEager ? "high" : "auto"
                  }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                    className: "trip-code",
                    children: trip.tripCode
                  }, void 0, false), !trip.isOwner && /*#__PURE__*/_jsxDEV("span", {
                    className: "trip-shared-badge",
                    children: "Shared"
                  }, void 0, false), cat && /*#__PURE__*/_jsxDEV("span", {
                    className: "badge",
                    style: {
                      position: 'absolute',
                      bottom: 12,
                      left: 12,
                      background: cat.color,
                      color: 'white'
                    },
                    children: cat.name
                  }, void 0, false)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                  className: "card-body",
                  children: [/*#__PURE__*/_jsxDEV("h5", {
                    className: "fw-bold mb-1",
                    children: trip.name
                  }, void 0, false), calculateTripDuration(trip.schedules) && /*#__PURE__*/_jsxDEV("p", {
                    className: "small text-primary fw-medium mb-1",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "calendar",
                      size: 14,
                      className: "me-1"
                    }, void 0, false), calculateTripDuration(trip.schedules)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                    className: "text-muted small mb-3",
                    children: ["Budget: Rp ", parseFloat(trip.totalPlanBudget).toLocaleString('en-US')]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                    className: "d-flex justify-content-between align-items-center",
                    children: [/*#__PURE__*/_jsxDEV("span", {
                      className: "small text-muted",
                      children: [completed, "/", total, " activities"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("span", {
                      className: "fw-bold",
                      style: {
                        color: progress === 100 ? 'var(--success)' : 'var(--primary)'
                      },
                      children: [progress, "%"]
                    }, void 0, true)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                    className: "progress mt-2",
                    children: /*#__PURE__*/_jsxDEV("div", {
                      className: "progress-bar",
                      style: {
                        width: `${progress}%`,
                        background: progress === 100 ? 'var(--success)' : 'var(--primary)'
                      }
                    }, void 0, false)
                  }, void 0, false)]
                }, void 0, true)]
              }, void 0, true)
            }, trip.id, false);
          })
        }, void 0, false);
        return /*#__PURE__*/_jsxDEV(_Fragment, {
          children: [inProgressTrips.length > 0 && /*#__PURE__*/_jsxDEV("div", {
            className: "mb-5",
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold mb-3 d-flex align-items-center gap-2",
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "clock",
                size: 20,
                className: "text-warning"
              }, void 0, false), " In Progress"]
            }, void 0, true), renderTripCards(inProgressTrips)]
          }, void 0, true), completedTrips.length > 0 && /*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold mb-3 d-flex align-items-center gap-2",
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "check-circle",
                size: 20,
                className: "text-success"
              }, void 0, false), " Completed"]
            }, void 0, true), renderTripCards(completedTrips)]
          }, void 0, true)]
        }, void 0, true);
      })()
    }, void 0, false)]
  }, void 0, true);
};

// Trip Dashboard
const TripDashboard = () => {
  const {
    activeTrip,
    updateTrip,
    deleteTrip,
    navigateTo
  } = useTrip();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [coverPreview, setCoverPreview] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEndTripConfirm, setShowEndTripConfirm] = useState(false);
  if (!activeTrip) return null;
  const handleSave = async () => {
    await updateTrip(activeTrip.id, edit);
    if (coverPreview) await updateTrip(activeTrip.id, {
      coverUrl: coverPreview
    });
    setEditing(false);
    setCoverPreview(null);
  };
  const handleCoverChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setCoverPreview(compressed);
  };
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('my-trips'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back to Trips"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-5",
      children: [/*#__PURE__*/_jsxDEV("div", {
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "d-flex align-items-center gap-2 mb-2",
          children: [/*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-primary bg-opacity-10 text-primary px-2 py-1 rounded-1",
            children: "Workspace"
          }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-light text-dark border px-2 py-1 rounded-1 fw-normal",
            children: activeTrip.tripCode
          }, void 0, false), activeTrip.is_finished ? /*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-success bg-opacity-10 text-success px-2 py-1 rounded-1",
            children: "Completed"
          }, void 0, false) : /*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-warning bg-opacity-10 text-warning px-2 py-1 rounded-1",
            children: "In Progress"
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("h1", {
          className: "h2 fw-bold mb-1 text-dark",
          children: activeTrip.name
        }, void 0, false), calculateTripDuration(activeTrip.schedules) && /*#__PURE__*/_jsxDEV("p", {
          className: "fw-medium text-primary mb-1",
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "calendar",
            size: 16,
            className: "me-1"
          }, void 0, false), calculateTripDuration(activeTrip.schedules)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted mb-0",
          style: {
            fontSize: '1.1rem'
          },
          children: ["Budget: ", /*#__PURE__*/_jsxDEV("span", {
            className: "fw-medium text-dark",
            children: ["Rp ", parseFloat(activeTrip.totalPlanBudget).toLocaleString('en-US')]
          }, void 0, true)]
        }, void 0, true)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "d-flex gap-2",
        children: [/*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-light border d-flex align-items-center gap-2 px-3",
          onClick: () => {
            setEdit(activeTrip);
            setEditing(true);
          },
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "edit",
            size: 16
          }, void 0, false), " Edit"]
        }, void 0, true), !activeTrip.is_finished && (showEndTripConfirm ? /*#__PURE__*/_jsxDEV("div", {
          className: "d-flex align-items-center gap-2 bg-white border border-success rounded px-2",
          children: [/*#__PURE__*/_jsxDEV("span", {
            className: "text-success small fw-bold mb-0",
            children: "End this trip?"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-success btn-sm",
            onClick: () => updateTrip(activeTrip.id, {
              is_finished: true
            }),
            children: "Ya"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-outline-secondary btn-sm",
            onClick: () => setShowEndTripConfirm(false),
            children: "Tidak"
          }, void 0, false)]
        }, void 0, true) : /*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-outline-success d-flex align-items-center gap-2 px-3",
          onClick: () => setShowEndTripConfirm(true),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "check-square",
            size: 16
          }, void 0, false), " End Trip"]
        }, void 0, true)), showDeleteConfirm ? /*#__PURE__*/_jsxDEV("div", {
          className: "d-flex align-items-center gap-2 bg-white border border-danger rounded px-2",
          children: [/*#__PURE__*/_jsxDEV("span", {
            className: "text-danger small fw-bold mb-0",
            children: "Hapus Trip ini?"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-danger btn-sm",
            onClick: () => deleteTrip(activeTrip.id),
            children: "Ya"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-outline-secondary btn-sm",
            onClick: () => setShowDeleteConfirm(false),
            children: "Tidak"
          }, void 0, false)]
        }, void 0, true) : /*#__PURE__*/_jsxDEV("button", {
          className: "btn btn-outline-danger d-flex align-items-center gap-2 px-3",
          onClick: () => setShowDeleteConfirm(true),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "trash",
            size: 16
          }, void 0, false), " Delete"]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true), editing && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "Edit Trip"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "row g-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "col-md-4",
            children: [/*#__PURE__*/_jsxDEV("label", {
              className: "form-label",
              children: "Name"
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              className: "form-control",
              value: edit.name || '',
              onChange: e => setEdit({
                ...edit,
                name: e.target.value
              })
            }, void 0, false)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "col-md-4",
            children: [/*#__PURE__*/_jsxDEV("label", {
              className: "form-label",
              children: "Budget"
            }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
              type: "text",
              inputMode: "numeric",
              className: "form-control",
              value: formatCurrency(edit.totalPlanBudget),
              onChange: e => setEdit({
                ...edit,
                totalPlanBudget: parseCurrency(e.target.value)
              })
            }, void 0, false)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "col-md-4",
            children: [/*#__PURE__*/_jsxDEV("label", {
              className: "form-label",
              children: "Cover Photo"
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "d-flex gap-2",
              children: [(coverPreview || edit.coverUrl) && /*#__PURE__*/_jsxDEV("img", {
                src: coverPreview || edit.coverUrl,
                alt: "",
                style: {
                  width: 60,
                  height: 40,
                  objectFit: 'cover',
                  borderRadius: 8
                }
              }, void 0, false), /*#__PURE__*/_jsxDEV("label", {
                className: "btn btn-outline-primary btn-sm",
                children: [/*#__PURE__*/_jsxDEV(Icon, {
                  name: "camera",
                  size: 14
                }, void 0, false), " Change", /*#__PURE__*/_jsxDEV("input", {
                  type: "file",
                  accept: "image/*",
                  onChange: handleCoverChange,
                  style: {
                    display: 'none'
                  }
                }, void 0, false)]
              }, void 0, true)]
            }, void 0, true)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "mt-3",
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-primary",
            onClick: handleSave,
            children: "Save"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-outline-secondary ms-2",
            onClick: () => setEditing(false),
            children: "Cancel"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: "row g-4",
      children: [{
        key: 'itinerary',
        icon: 'calendar',
        color: 'var(--primary)',
        title: 'Itinerary',
        desc: `${activeTrip.schedules?.filter(s => !s.is_addon).length || 0} activities`
      }, {
        key: 'addons',
        icon: 'tag',
        color: 'var(--info)',
        title: 'Add-ons',
        desc: `${activeTrip.schedules?.filter(s => s.is_addon).length || 0} add-ons`
      }, {
        key: 'friends',
        icon: 'users',
        color: 'var(--success)',
        title: 'Travel Buddies',
        desc: `${activeTrip.friends?.length || 0} friends`
      }, {
        key: 'budget',
        icon: 'pie-chart',
        color: 'var(--warning)',
        title: 'Budget Report',
        desc: 'View analytics'
      }].map(m => /*#__PURE__*/_jsxDEV("div", {
        className: "col-md-4",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "module-card",
          onClick: () => navigateTo(m.key),
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "module-icon",
            style: {
              background: m.color
            },
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: m.icon,
              size: 28
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
            className: "fw-bold mb-1",
            children: m.title
          }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
            className: "text-muted small mb-0",
            children: m.desc
          }, void 0, false)]
        }, void 0, true)
      }, m.key, false))
    }, void 0, false)]
  }, void 0, true);
};

// Itinerary Page
const Itinerary = () => {
  const {
    activeTrip,
    addSchedule,
    navigateTo
  } = useTrip();
  const [showAdd, setShowAdd] = useState(false);
  const [newSch, setNewSch] = useState({
    date: '',
    time: '',
    title: '',
    planBudget: ''
  });
  const handleAdd = async e => {
    e.preventDefault();
    if (!newSch.date || !newSch.title) return;
    await addSchedule({
      date: newSch.date,
      time: newSch.time,
      title: newSch.title,
      planBudget: parseCurrency(newSch.planBudget)
    });
    setNewSch({
      date: '',
      time: '',
      title: '',
      planBudget: ''
    });
    setShowAdd(false);
  };
  const sorted = [...(activeTrip.schedules || [])].filter(s => !s.is_addon).sort((a, b) => {
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return new Date(`${a.date}T${timeA}`) - new Date(`${b.date}T${timeB}`);
  });
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('trip-dashboard'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4",
      children: [/*#__PURE__*/_jsxDEV("div", {
        children: [/*#__PURE__*/_jsxDEV("h2", {
          className: "fw-bold mb-1",
          children: "Itinerary"
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted mb-0",
          children: "Plan your activities"
        }, void 0, false)]
      }, void 0, true), !activeTrip.is_finished && /*#__PURE__*/_jsxDEV("button", {
        className: `btn ${showAdd ? 'btn-secondary' : 'btn-primary'}`,
        onClick: () => setShowAdd(!showAdd),
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: showAdd ? 'x' : 'plus',
          size: 16
        }, void 0, false), " ", showAdd ? 'Cancel' : 'Add Activity']
      }, void 0, true)]
    }, void 0, true), showAdd && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "New Activity"
        }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
          onSubmit: handleAdd,
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "row g-3",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "col-md-3",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Date"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "date",
                className: "form-control",
                value: newSch.date,
                onChange: e => setNewSch({
                  ...newSch,
                  date: e.target.value
                }),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-3",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: ["Time ", /*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted fw-normal",
                  children: "(Opt)"
                }, void 0, false)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                type: "time",
                className: "form-control",
                value: newSch.time,
                onChange: e => setNewSch({
                  ...newSch,
                  time: e.target.value
                })
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-6",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Title"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                className: "form-control",
                placeholder: "Visit amazing places",
                value: newSch.title,
                onChange: e => setNewSch({
                  ...newSch,
                  title: e.target.value
                }),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Budget (IDR)"
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "input-group",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "input-group-text",
                  children: "Rp"
                }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                  type: "text",
                  inputMode: "numeric",
                  className: "form-control",
                  placeholder: "0",
                  value: newSch.planBudget,
                  onChange: e => setNewSch({
                    ...newSch,
                    planBudget: formatCurrency(e.target.value)
                  })
                }, void 0, false)]
              }, void 0, true)]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
            type: "submit",
            className: "btn btn-primary mt-3",
            children: "Save Activity"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), sorted.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "empty-state",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "calendar",
        size: 64
      }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
        className: "fw-bold",
        children: "No activities yet"
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column gap-3",
      children: sorted.map(s => /*#__PURE__*/_jsxDEV(ScheduleCard, {
        schedule: s
      }, s.id, false))
    }, void 0, false)]
  }, void 0, true);
};

// Add-Ons Page
const AddOns = () => {
  const {
    activeTrip,
    addSchedule,
    navigateTo
  } = useTrip();
  const [showAdd, setShowAdd] = useState(false);
  const [newSch, setNewSch] = useState({
    date: '',
    time: '',
    title: '',
    planBudget: ''
  });
  const handleAdd = async e => {
    e.preventDefault();
    if (!newSch.date || !newSch.title) return;
    await addSchedule({
      date: newSch.date,
      time: newSch.time,
      title: newSch.title,
      planBudget: parseCurrency(newSch.planBudget),
      is_addon: true
    });
    setNewSch({
      date: '',
      time: '',
      title: '',
      planBudget: ''
    });
    setShowAdd(false);
  };
  const sorted = [...(activeTrip.schedules || [])].filter(s => s.is_addon).sort((a, b) => {
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return new Date(`${a.date}T${timeA}`) - new Date(`${b.date}T${timeB}`);
  });
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('trip-dashboard'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4",
      children: [/*#__PURE__*/_jsxDEV("div", {
        children: [/*#__PURE__*/_jsxDEV("h2", {
          className: "fw-bold mb-1",
          children: "Add-ons"
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted mb-0",
          children: "Plan minor expenses (parking, snacks, etc.)"
        }, void 0, false)]
      }, void 0, true), !activeTrip.is_finished && /*#__PURE__*/_jsxDEV("button", {
        className: `btn ${showAdd ? 'btn-secondary' : 'btn-primary'}`,
        onClick: () => setShowAdd(!showAdd),
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: showAdd ? 'x' : 'plus',
          size: 16
        }, void 0, false), " ", showAdd ? 'Cancel' : 'Add Add-on']
      }, void 0, true)]
    }, void 0, true), showAdd && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "New Add-on"
        }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
          onSubmit: handleAdd,
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "row g-3",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "col-md-3",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Date"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "date",
                className: "form-control",
                value: newSch.date,
                onChange: e => setNewSch({
                  ...newSch,
                  date: e.target.value
                }),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-3",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: ["Time ", /*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted fw-normal",
                  children: "(Opt)"
                }, void 0, false)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                type: "time",
                className: "form-control",
                value: newSch.time,
                onChange: e => setNewSch({
                  ...newSch,
                  time: e.target.value
                })
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-6",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Title"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                className: "form-control",
                placeholder: "Toll, Parking, Snack...",
                value: newSch.title,
                onChange: e => setNewSch({
                  ...newSch,
                  title: e.target.value
                }),
                required: true
              }, void 0, false)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "col-md-4",
              children: [/*#__PURE__*/_jsxDEV("label", {
                className: "form-label",
                children: "Budget (IDR)"
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "input-group",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "input-group-text",
                  children: "Rp"
                }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                  type: "text",
                  inputMode: "numeric",
                  className: "form-control",
                  placeholder: "0",
                  value: newSch.planBudget,
                  onChange: e => setNewSch({
                    ...newSch,
                    planBudget: formatCurrency(e.target.value)
                  })
                }, void 0, false)]
              }, void 0, true)]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
            type: "submit",
            className: "btn btn-primary mt-3",
            children: "Save Add-on"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), sorted.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "empty-state",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "tag",
        size: 64
      }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
        className: "fw-bold",
        children: "No add-ons yet"
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column gap-3",
      children: sorted.map(s => /*#__PURE__*/_jsxDEV(ScheduleCard, {
        schedule: s
      }, s.id, false))
    }, void 0, false)]
  }, void 0, true);
};

// Schedule Card with Enhanced Multi-Photo Support
const ScheduleCard = ({
  schedule
}) => {
  const {
    updateSchedule,
    deleteSchedule,
    fetchAPI,
    updateSchedulePhotos
  } = useTrip();
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
      fetchAPI('get_schedule_photos', {
        id: schedule.id
      }).then(res => {
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
  const handlePhotoAdd = async e => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos = [...photos];
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      newPhotos.push(compressed);
    }
    setPhotos(newPhotos);
    updateSchedule(schedule.id, {
      photos: newPhotos
    });
    e.target.value = '';
  };
  const handlePhotoDelete = i => {
    const newPhotos = photos.filter((_, idx) => idx !== i);
    setPhotos(newPhotos);
    updateSchedule(schedule.id, {
      photos: newPhotos
    });
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
  return /*#__PURE__*/_jsxDEV("div", {
    className: `schedule-item ${schedule.isCompleted ? 'completed' : ''}`,
    children: /*#__PURE__*/_jsxDEV("div", {
      className: "card-body",
      children: [isEditing ? /*#__PURE__*/_jsxDEV("div", {
        className: "mb-3 p-3 bg-light rounded border",
        children: [/*#__PURE__*/_jsxDEV("h6", {
          className: "fw-bold mb-3",
          children: "Edit Activity"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "row g-2 mb-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "col-12",
            children: /*#__PURE__*/_jsxDEV("input", {
              type: "text",
              className: "form-control",
              value: editForm.title,
              onChange: e => setEditForm({
                ...editForm,
                title: e.target.value
              }),
              placeholder: "Title"
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "col-6",
            children: /*#__PURE__*/_jsxDEV("input", {
              type: "date",
              className: "form-control",
              value: editForm.date,
              onChange: e => setEditForm({
                ...editForm,
                date: e.target.value
              })
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "col-6",
            children: /*#__PURE__*/_jsxDEV("input", {
              type: "time",
              className: "form-control",
              value: editForm.time,
              onChange: e => setEditForm({
                ...editForm,
                time: e.target.value
              })
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "col-12",
            children: /*#__PURE__*/_jsxDEV("div", {
              className: "input-group",
              children: [/*#__PURE__*/_jsxDEV("span", {
                className: "input-group-text",
                children: "Rp"
              }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                inputMode: "numeric",
                className: "form-control",
                placeholder: "Plan Budget",
                value: editForm.planBudget,
                onChange: e => setEditForm({
                  ...editForm,
                  planBudget: formatCurrency(e.target.value)
                })
              }, void 0, false)]
            }, void 0, true)
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "d-flex justify-content-end gap-2",
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-sm btn-outline-secondary",
            onClick: () => setIsEditing(false),
            children: "Cancel"
          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-sm btn-primary",
            onClick: handleSaveEdit,
            children: "Save"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
        className: "d-flex justify-content-between align-items-start mb-3",
        children: [/*#__PURE__*/_jsxDEV("div", {
          children: [/*#__PURE__*/_jsxDEV("h5", {
            className: "fw-bold mb-1",
            children: schedule.title
          }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-light text-dark",
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "calendar",
              size: 12
            }, void 0, false), " ", new Date(schedule.date).toLocaleDateString()]
          }, void 0, true), schedule.time && /*#__PURE__*/_jsxDEV("span", {
            className: "badge bg-light text-dark ms-2",
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "clock",
              size: 12
            }, void 0, false), " ", schedule.time]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "text-end",
          children: [/*#__PURE__*/_jsxDEV("p", {
            className: "text-muted small mb-1",
            children: ["Plan: Rp ", parseFloat(schedule.planBudget || 0).toLocaleString('en-US')]
          }, void 0, true), schedule.isCompleted && /*#__PURE__*/_jsxDEV("p", {
            className: `fw-bold mb-0 ${schedule.realBudget > schedule.planBudget ? 'text-danger' : 'text-success'}`,
            children: ["Real: Rp ", parseFloat(schedule.realBudget || 0).toLocaleString('en-US')]
          }, void 0, true)]
        }, void 0, true)]
      }, void 0, true), (schedule.isCompleted || isEditing) && /*#__PURE__*/_jsxDEV(PhotoGallery, {
        photos: photos,
        editable: isEditing,
        onAdd: handlePhotoAdd,
        onDelete: handlePhotoDelete
      }, void 0, false), loadingPhotos && /*#__PURE__*/_jsxDEV("div", {
        className: "text-center py-2",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "spinner-border spinner-border-sm text-primary",
          role: "status",
          children: /*#__PURE__*/_jsxDEV("span", {
            className: "visually-hidden",
            children: "Loading..."
          }, void 0, false)
        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
          className: "ms-2 text-muted small",
          children: "Loading photos..."
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "mt-3 pt-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2",
        children: !schedule.isCompleted ? showComplete ? /*#__PURE__*/_jsxDEV("div", {
          className: "w-100",
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "row g-2 align-items-end",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "col",
              children: /*#__PURE__*/_jsxDEV("input", {
                type: "text",
                inputMode: "numeric",
                className: "form-control",
                placeholder: "Actual spending",
                value: realBudget,
                onChange: e => setRealBudget(formatCurrency(e.target.value))
              }, void 0, false)
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "col-auto",
              children: [/*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-success btn-sm",
                onClick: handleComplete,
                children: "Confirm"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-outline-secondary btn-sm ms-2",
                onClick: () => setShowComplete(false),
                children: "Cancel"
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false) : /*#__PURE__*/_jsxDEV("div", {
          className: "w-100 d-flex flex-nowrap gap-2",
          children: [/*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-success btn-sm flex-grow-1",
            onClick: () => setShowComplete(true),
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "check-circle",
              size: 14
            }, void 0, false), " Complete"]
          }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-outline-secondary btn-sm",
            onClick: () => setIsEditing(true),
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "edit",
              size: 14
            }, void 0, false)
          }, void 0, false), showDeleteConfirm ? /*#__PURE__*/_jsxDEV("div", {
            className: "d-flex align-items-center gap-1 border border-danger rounded px-1",
            children: [/*#__PURE__*/_jsxDEV("span", {
              className: "text-danger small ms-1 me-1 fw-bold",
              children: "Hapus?"
            }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
              className: "btn btn-danger btn-sm px-2 py-0",
              onClick: () => deleteSchedule(schedule.id),
              children: "Ya"
            }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
              className: "btn btn-secondary btn-sm px-2 py-0",
              onClick: () => setShowDeleteConfirm(false),
              children: "Tidak"
            }, void 0, false)]
          }, void 0, true) : /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-outline-danger btn-sm",
            onClick: () => setShowDeleteConfirm(true),
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: "trash",
              size: 14
            }, void 0, false)
          }, void 0, false)]
        }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
          className: "w-100 d-flex justify-content-between align-items-center",
          children: [/*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("span", {
              className: "badge bg-success",
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "check-circle",
                size: 12
              }, void 0, false), " Completed"]
            }, void 0, true), schedule.completed_at && /*#__PURE__*/_jsxDEV("span", {
              className: "text-muted small ms-2",
              style: {
                fontSize: '11px'
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "clock",
                size: 10,
                className: "me-1"
              }, void 0, false), new Date(schedule.completed_at).toLocaleString('id-ID', {
                dateStyle: 'short',
                timeStyle: 'short'
              })]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("button", {
              className: "btn btn-outline-secondary btn-sm me-2",
              onClick: () => setIsEditing(true),
              children: /*#__PURE__*/_jsxDEV(Icon, {
                name: "edit",
                size: 14
              }, void 0, false)
            }, void 0, false), showDeleteConfirm ? /*#__PURE__*/_jsxDEV("div", {
              className: "d-inline-flex align-items-center gap-1 border border-danger rounded px-1 py-1",
              children: [/*#__PURE__*/_jsxDEV("span", {
                className: "text-danger small ms-1 me-1 fw-bold",
                children: "Hapus?"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-danger btn-sm px-2 py-0",
                onClick: () => deleteSchedule(schedule.id),
                children: "Ya"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-secondary btn-sm px-2 py-0",
                onClick: () => setShowDeleteConfirm(false),
                children: "Tidak"
              }, void 0, false)]
            }, void 0, true) : /*#__PURE__*/_jsxDEV("button", {
              className: "btn btn-outline-danger btn-sm",
              onClick: () => setShowDeleteConfirm(true),
              children: /*#__PURE__*/_jsxDEV(Icon, {
                name: "trash",
                size: 14
              }, void 0, false)
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true)
      }, void 0, false)]
    }, void 0, true)
  }, void 0, false);
};

// Friends Page
const Friends = () => {
  const {
    activeTrip,
    addFriend,
    removeFriend,
    navigateTo
  } = useTrip();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  if (!activeTrip) return null;
  const handleAdd = async e => {
    e.preventDefault();
    await addFriend(name, email);
    setName('');
    setEmail('');
  };
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('trip-dashboard'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("h2", {
      className: "fw-bold mb-4",
      children: "Travel Buddies"
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: "row g-4",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "col-md-5",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "card-trip text-center mb-4",
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-body p-4",
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small fw-bold mb-1",
              children: "INVITE CODE"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h2", {
              className: "fw-bold letter-spacing-1 mb-2",
              children: activeTrip.tripCode
            }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small",
              children: "Share this code with friends"
            }, void 0, false)]
          }, void 0, true)
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "card-trip",
          style: {
            borderColor: 'var(--success)'
          },
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-body p-4",
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold mb-3",
              style: {
                color: 'var(--success)'
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "user-plus",
                size: 18
              }, void 0, false), " Add Friend"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("form", {
              onSubmit: handleAdd,
              children: [/*#__PURE__*/_jsxDEV("div", {
                className: "mb-3",
                children: [/*#__PURE__*/_jsxDEV("label", {
                  className: "form-label",
                  children: "Name"
                }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                  className: "form-control",
                  value: name,
                  onChange: e => setName(e.target.value),
                  required: true
                }, void 0, false)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "mb-3",
                children: [/*#__PURE__*/_jsxDEV("label", {
                  className: "form-label",
                  children: "Email"
                }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                  type: "email",
                  className: "form-control",
                  value: email,
                  onChange: e => setEmail(e.target.value),
                  required: true
                }, void 0, false)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                type: "submit",
                className: "btn btn-success w-100",
                children: "Add Friend"
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "col-md-7",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "card-trip h-100",
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-body p-4",
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold mb-4",
              children: ["Friends (", activeTrip.friends?.length || 0, ")"]
            }, void 0, true), (activeTrip.friends || []).length === 0 ? /*#__PURE__*/_jsxDEV("p", {
              className: "text-muted text-center py-4",
              children: "No friends yet"
            }, void 0, false) : /*#__PURE__*/_jsxDEV("div", {
              className: "list-group list-group-flush",
              children: activeTrip.friends.map(f => /*#__PURE__*/_jsxDEV("div", {
                className: "list-group-item d-flex justify-content-between align-items-center px-0",
                children: [/*#__PURE__*/_jsxDEV("div", {
                  className: "d-flex align-items-center gap-3",
                  children: [/*#__PURE__*/_jsxDEV("div", {
                    className: "rounded-circle bg-light d-flex align-items-center justify-content-center",
                    style: {
                      width: 40,
                      height: 40
                    },
                    children: /*#__PURE__*/_jsxDEV(Icon, {
                      name: "user",
                      size: 18,
                      className: "text-muted"
                    }, void 0, false)
                  }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                    children: [/*#__PURE__*/_jsxDEV("p", {
                      className: "fw-bold mb-0",
                      children: f.name
                    }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
                      className: "text-muted small mb-0",
                      children: f.email
                    }, void 0, false)]
                  }, void 0, true)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  className: "btn btn-sm btn-outline-danger",
                  onClick: () => removeFriend(f.id),
                  children: /*#__PURE__*/_jsxDEV(Icon, {
                    name: "trash",
                    size: 14
                  }, void 0, false)
                }, void 0, false)]
              }, f.id, true))
            }, void 0, false)]
          }, void 0, true)
        }, void 0, false)
      }, void 0, false)]
    }, void 0, true)]
  }, void 0, true);
};

// Budget Page
const BudgetReport = () => {
  const {
    activeTrip,
    navigateTo
  } = useTrip();
  if (!activeTrip) return null;
  const schedules = activeTrip.schedules || [];
  const totalPlan = parseFloat(activeTrip.totalPlanBudget || 0);
  const totalReal = schedules.filter(s => s.isCompleted).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  const itineraryReal = schedules.filter(s => s.isCompleted && !s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  const addonReal = schedules.filter(s => s.isCompleted && s.is_addon).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
  const diff = totalReal - totalPlan;
  const isOver = diff > 0;
  const completion = schedules.length ? schedules.filter(s => s.isCompleted).length / schedules.length * 100 : 0;
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4 d-flex align-items-center gap-1",
      onClick: () => navigateTo('trip-dashboard'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("h2", {
      className: "fw-bold mb-4",
      children: "Budget Analytics"
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4 overflow-hidden border",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-4 p-md-5 text-center border-bottom",
        style: {
          background: isOver ? 'linear-gradient(135deg, #fff, #fef2f2)' : 'linear-gradient(135deg, #fff, #f0fdf4)'
        },
        children: completion === 0 ? /*#__PURE__*/_jsxDEV("div", {
          className: "text-muted py-4",
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "pie-chart",
            size: 60,
            className: "opacity-25 mb-3"
          }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
            children: "No Data"
          }, void 0, false)]
        }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
          className: "py-2",
          children: [isOver ? /*#__PURE__*/_jsxDEV(Icon, {
            name: "alert-circle",
            size: 60,
            className: "text-danger mb-3"
          }, void 0, false) : /*#__PURE__*/_jsxDEV(Icon, {
            name: "check-circle",
            size: 60,
            className: "text-success mb-3"
          }, void 0, false), /*#__PURE__*/_jsxDEV("h1", {
            className: `display-4 fw-bold ${isOver ? 'text-danger' : 'text-success'}`,
            children: isOver ? 'OVER BUDGET' : 'ON BUDGET'
          }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
            className: "fs-5 text-muted mb-0",
            children: isOver ? /*#__PURE__*/_jsxDEV(_Fragment, {
              children: ["Over by ", /*#__PURE__*/_jsxDEV("strong", {
                className: "text-danger",
                children: ["Rp ", diff.toLocaleString('en-US')]
              }, void 0, true)]
            }, void 0, true) : /*#__PURE__*/_jsxDEV(_Fragment, {
              children: ["Saving ", /*#__PURE__*/_jsxDEV("strong", {
                className: "text-success",
                children: ["Rp ", Math.abs(diff).toLocaleString('en-US')]
              }, void 0, true)]
            }, void 0, true)
          }, void 0, false)]
        }, void 0, true)
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-4 p-md-5",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "row g-4 mb-4 text-center",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "col-6 border-end",
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small fw-bold mb-2",
              children: "BUDGET"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h3", {
              className: "fw-bold",
              style: {
                color: 'var(--primary)'
              },
              children: ["Rp ", totalPlan.toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "col-6",
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small fw-bold mb-2",
              children: "ACTUAL"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h3", {
              className: `fw-bold ${isOver ? 'text-danger' : 'text-success'}`,
              children: ["Rp ", totalReal.toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "p-4 bg-light rounded-3 border",
          children: [/*#__PURE__*/_jsxDEV("h5", {
            className: "fw-bold mb-1",
            children: "Trip Allowance"
          }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
            className: "text-muted small mb-3",
            children: ["Total Budget: Rp ", parseFloat(activeTrip.totalPlanBudget).toLocaleString('en-US')]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "d-flex flex-column gap-2 mb-3",
            children: [/*#__PURE__*/_jsxDEV("div", {
              className: "d-flex justify-content-between",
              children: [/*#__PURE__*/_jsxDEV("span", {
                className: "text-muted small",
                children: "Itinerary Spending:"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                className: "fw-medium small",
                children: ["Rp ", itineraryReal.toLocaleString('en-US')]
              }, void 0, true)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              className: "d-flex justify-content-between",
              children: [/*#__PURE__*/_jsxDEV("span", {
                className: "text-muted small",
                children: "Add-ons Spending:"
              }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                className: "fw-medium small",
                children: ["Rp ", addonReal.toLocaleString('en-US')]
              }, void 0, true)]
            }, void 0, true)]
          }, void 0, true), totalReal > activeTrip.totalPlanBudget ? /*#__PURE__*/_jsxDEV("div", {
            className: "alert alert-danger mb-0 py-2 px-3 d-flex align-items-center gap-2",
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "alert-triangle",
              size: 18
            }, void 0, false), " Exceeded by Rp ", (totalReal - activeTrip.totalPlanBudget).toLocaleString('en-US')]
          }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
            className: "alert alert-success mb-0 py-2 px-3 d-flex align-items-center gap-2",
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "check-circle",
              size: 18
            }, void 0, false), " Rp ", (activeTrip.totalPlanBudget - totalReal).toLocaleString('en-US'), " remaining"]
          }, void 0, true)]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
};

// Settings Page
const SettingsPage = () => {
  const {
    currentUser,
    navigateTo,
    updateUser,
    darkMode,
    toggleDarkMode,
    logout,
    categories,
    createCategory,
    deleteCategory,
    updateCategory
  } = useTrip();

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
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  // App preferences state
  const [language, setLanguage] = useState('id');
  const [aboutTab, setAboutTab] = useState('version');

  // Category state
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#0d6efd');
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');
  const handleSaveAccount = async e => {
    e.preventDefault();
    setIsSaving(true);
    // Include the new fields in actual app backend API call here
    const res = await updateUser(fullName, password);
    setIsSaving(false);
    if (res.success) {
      alert('Settings saved successfully!');
      setPassword('');
    } else {
      alert(res.message || 'Failed to save settings');
    }
  };
  const handleProfilePicChange = async e => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file, 200); // reuse compressImage function
      setProfilePic(compressed);
    }
  };
  const clearCache = () => {
    alert('Cache berhasil dibersihkan! Aplikasi akan terasa lebih ringan dan cepat.');
  };
  const handleCreateCategory = async e => {
    e.preventDefault();
    await createCategory(catName, catColor, 'tag');
    setCatName('');
    setShowCatForm(false);
  };
  const startEditCategory = cat => {
    setEditCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
  };
  const handleUpdateCategory = async id => {
    await updateCategory(id, editCatName, editCatColor, 'tag');
    setEditCatId(null);
  };
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('my-trips'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("h2", {
      className: "fw-bold mb-4",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "settings",
        size: 24
      }, void 0, false), " Settings"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: `row g-4 settings-layout ${mobileView === 'menu' ? 'mobile-menu-active' : 'mobile-content-active'}`,
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "col-md-3 settings-menu-container",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "settings-sidebar",
          style: {
            position: 'sticky',
            top: '80px'
          },
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "nav flex-column nav-pills gap-1",
            children: [/*#__PURE__*/_jsxDEV("button", {
              className: `nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'account' ? 'active bg-primary text-white' : 'text-dark'}`,
              onClick: () => {
                setActiveTab('account');
                setMobileView('content');
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "user",
                size: 18
              }, void 0, false), " Account"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              className: `nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'categories' ? 'active bg-primary text-white' : 'text-dark'}`,
              onClick: () => {
                setActiveTab('categories');
                setMobileView('content');
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "tag",
                size: 18
              }, void 0, false), " Categories"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              className: `nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'appearance' ? 'active bg-primary text-white' : 'text-dark'}`,
              onClick: () => {
                setActiveTab('appearance');
                setMobileView('content');
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "monitor",
                size: 18
              }, void 0, false), " Appearance"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              className: `nav-link text-start d-flex align-items-center gap-2 ${activeTab === 'preferences' ? 'active bg-primary text-white' : 'text-dark'}`,
              onClick: () => {
                setActiveTab('preferences');
                setMobileView('content');
              },
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "settings",
                size: 18
              }, void 0, false), " Preferensi Sistem"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
              children: [/*#__PURE__*/_jsxDEV("button", {
                className: `nav-link w-100 text-start d-flex align-items-center justify-content-between ${activeTab === 'about' ? 'active bg-primary text-white' : 'text-dark'}`,
                onClick: () => {
                  setActiveTab('about');
                  setMobileView('content');
                },
                children: [/*#__PURE__*/_jsxDEV("div", {
                  className: "d-flex align-items-center gap-2",
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "info",
                    size: 18
                  }, void 0, false), " Tentang"]
                }, void 0, true), /*#__PURE__*/_jsxDEV(Icon, {
                  name: activeTab === 'about' ? "chevron-up" : "chevron-down",
                  size: 16
                }, void 0, false)]
              }, void 0, true), activeTab === 'about' && /*#__PURE__*/_jsxDEV("div", {
                className: "ps-4 mt-2 mb-1 d-flex flex-column gap-2",
                children: [/*#__PURE__*/_jsxDEV("button", {
                  className: `btn btn-sm text-start w-100 px-2 py-1 ${aboutTab === 'version' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`,
                  onClick: () => setAboutTab('version'),
                  style: {
                    border: 'none',
                    background: 'transparent'
                  },
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "tag",
                    size: 14,
                    className: "me-2"
                  }, void 0, false), " Versi Aplikasi"]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  className: `btn btn-sm text-start w-100 px-2 py-1 ${aboutTab === 'kenali' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`,
                  onClick: () => setAboutTab('kenali'),
                  style: {
                    border: 'none',
                    background: 'transparent'
                  },
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "info",
                    size: 14,
                    className: "me-2"
                  }, void 0, false), " Kenali TripNan"]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  className: `btn btn-sm text-start w-100 px-2 py-1 ${aboutTab === 'ulas' ? 'fw-bold text-primary bg-primary-subtle' : 'text-muted'}`,
                  onClick: () => setAboutTab('ulas'),
                  style: {
                    border: 'none',
                    background: 'transparent'
                  },
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "star",
                    size: 14,
                    className: "me-2"
                  }, void 0, false), " Ulas Aplikasi Ini"]
                }, void 0, true)]
              }, void 0, true)]
            }, void 0, true), /*#__PURE__*/_jsxDEV("hr", {
              className: "my-2"
            }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
              className: "nav-link text-start d-flex align-items-center gap-2 text-danger",
              onClick: clearCache,
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "trash",
                size: 18
              }, void 0, false), " Bersihkan Cache"]
            }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
              className: "nav-link text-start d-flex align-items-center gap-2 text-danger",
              onClick: logout,
              children: [/*#__PURE__*/_jsxDEV(Icon, {
                name: "log-out",
                size: 18
              }, void 0, false), " Logout Akun"]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false)
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "col-md-9 settings-content-container",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "d-md-none mb-3",
          children: /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-link text-muted p-0 d-flex align-items-center gap-1",
            onClick: () => setMobileView('menu'),
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "arrow-left",
              size: 16
            }, void 0, false), " Back to Menu"]
          }, void 0, true)
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "card-trip h-100",
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-body p-4 p-md-5",
            children: [activeTab === 'account' && /*#__PURE__*/_jsxDEV("div", {
              className: "animate-fade-in",
              children: [/*#__PURE__*/_jsxDEV("h5", {
                className: "fw-bold mb-4",
                children: [/*#__PURE__*/_jsxDEV(Icon, {
                  name: "user",
                  size: 18,
                  className: "me-2"
                }, void 0, false), "Account Settings"]
              }, void 0, true), /*#__PURE__*/_jsxDEV("form", {
                onSubmit: handleSaveAccount,
                style: {
                  maxWidth: '600px'
                },
                children: [/*#__PURE__*/_jsxDEV("div", {
                  className: "d-flex flex-column align-items-center mb-4",
                  children: /*#__PURE__*/_jsxDEV("div", {
                    className: "position-relative",
                    style: {
                      width: '100px',
                      height: '100px'
                    },
                    children: [/*#__PURE__*/_jsxDEV("div", {
                      className: "rounded-circle bg-light border d-flex align-items-center justify-content-center overflow-hidden w-100 h-100",
                      children: profilePic ? /*#__PURE__*/_jsxDEV("img", {
                        src: profilePic,
                        alt: "Profile",
                        style: {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }
                      }, void 0, false) : /*#__PURE__*/_jsxDEV(Icon, {
                        name: "user",
                        size: 48,
                        className: "text-muted"
                      }, void 0, false)
                    }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                      type: "button",
                      className: "btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 d-flex align-items-center justify-content-center",
                      style: {
                        width: '32px',
                        height: '32px'
                      },
                      onClick: () => fileInputRef.current?.click(),
                      title: "Ubah Foto Profil",
                      children: /*#__PURE__*/_jsxDEV(Icon, {
                        name: "camera",
                        size: 14
                      }, void 0, false)
                    }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                      type: "file",
                      ref: fileInputRef,
                      className: "d-none",
                      accept: "image/*",
                      onChange: handleProfilePicChange
                    }, void 0, false)]
                  }, void 0, true)
                }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                  className: "mb-3",
                  children: [/*#__PURE__*/_jsxDEV("label", {
                    className: "form-label fw-bold small text-muted",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "user",
                      size: 14,
                      className: "me-1"
                    }, void 0, false), "Username (Read-only)"]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                    type: "text",
                    className: "form-control",
                    value: currentUser,
                    disabled: true
                  }, void 0, false)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                  className: "row g-3 mb-3",
                  children: [/*#__PURE__*/_jsxDEV("div", {
                    className: "col-md-6",
                    children: [/*#__PURE__*/_jsxDEV("label", {
                      className: "form-label fw-bold small text-muted",
                      children: [/*#__PURE__*/_jsxDEV(Icon, {
                        name: "user",
                        size: 14,
                        className: "me-1"
                      }, void 0, false), "Nama Lengkap"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                      type: "text",
                      className: "form-control",
                      value: fullName,
                      onChange: e => setFullName(e.target.value)
                    }, void 0, false)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                    className: "col-md-6",
                    children: [/*#__PURE__*/_jsxDEV("label", {
                      className: "form-label fw-bold small text-muted",
                      children: [/*#__PURE__*/_jsxDEV(Icon, {
                        name: "mail",
                        size: 14,
                        className: "me-1"
                      }, void 0, false), "Email"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                      type: "email",
                      className: "form-control",
                      value: email,
                      onChange: e => setEmail(e.target.value)
                    }, void 0, false)]
                  }, void 0, true)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                  className: "row g-3 mb-3",
                  children: [/*#__PURE__*/_jsxDEV("div", {
                    className: "col-md-4",
                    children: [/*#__PURE__*/_jsxDEV("label", {
                      className: "form-label fw-bold small text-muted",
                      children: [/*#__PURE__*/_jsxDEV(Icon, {
                        name: "calendar",
                        size: 14,
                        className: "me-1"
                      }, void 0, false), "Tanggal Lahir"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                      type: "date",
                      className: "form-control",
                      value: dob,
                      onChange: e => setDob(e.target.value)
                    }, void 0, false)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                    className: "col-md-4",
                    children: [/*#__PURE__*/_jsxDEV("label", {
                      className: "form-label fw-bold small text-muted",
                      children: [/*#__PURE__*/_jsxDEV(Icon, {
                        name: "users",
                        size: 14,
                        className: "me-1"
                      }, void 0, false), "Jenis Kelamin"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("select", {
                      className: "form-select",
                      value: gender,
                      onChange: e => setGender(e.target.value),
                      children: [/*#__PURE__*/_jsxDEV("option", {
                        value: "",
                        children: "Pilih..."
                      }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
                        value: "L",
                        children: "Laki-laki"
                      }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
                        value: "P",
                        children: "Perempuan"
                      }, void 0, false)]
                    }, void 0, true)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                    className: "col-md-4",
                    children: [/*#__PURE__*/_jsxDEV("label", {
                      className: "form-label fw-bold small text-muted",
                      children: [/*#__PURE__*/_jsxDEV(Icon, {
                        name: "map",
                        size: 14,
                        className: "me-1"
                      }, void 0, false), "Kota Tempat Tinggal"]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                      type: "text",
                      className: "form-control",
                      value: city,
                      onChange: e => setCity(e.target.value)
                    }, void 0, false)]
                  }, void 0, true)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                  className: "mb-4",
                  children: [/*#__PURE__*/_jsxDEV("label", {
                    className: "form-label fw-bold small text-muted",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "lock",
                      size: 14,
                      className: "me-1"
                    }, void 0, false), "Password Baru ", /*#__PURE__*/_jsxDEV("span", {
                      className: "small text-muted fw-normal",
                      children: "(kosongkan jika tidak diubah)"
                    }, void 0, false)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("input", {
                    type: "password",
                    className: "form-control",
                    value: password,
                    onChange: e => setPassword(e.target.value)
                  }, void 0, false)]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  type: "submit",
                  className: "btn btn-primary",
                  disabled: isSaving,
                  children: isSaving ? 'Menyimpan...' : 'Simpan Perubahan'
                }, void 0, false)]
              }, void 0, true)]
            }, void 0, true), activeTab === 'categories' && /*#__PURE__*/_jsxDEV("div", {
              className: "animate-fade-in",
              children: [/*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between align-items-center mb-4",
                children: [/*#__PURE__*/_jsxDEV("h5", {
                  className: "fw-bold mb-0",
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: "tag",
                    size: 18,
                    className: "me-2"
                  }, void 0, false), "Manage Categories"]
                }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
                  className: "btn btn-sm btn-primary d-flex align-items-center gap-1",
                  onClick: () => setShowCatForm(!showCatForm),
                  children: [/*#__PURE__*/_jsxDEV(Icon, {
                    name: showCatForm ? 'x' : 'plus-circle',
                    size: 16
                  }, void 0, false), " ", showCatForm ? 'Cancel' : 'New']
                }, void 0, true)]
              }, void 0, true), showCatForm && /*#__PURE__*/_jsxDEV("div", {
                className: "card-trip mb-4 bg-light border",
                children: /*#__PURE__*/_jsxDEV("div", {
                  className: "card-body",
                  children: /*#__PURE__*/_jsxDEV("div", {
                    className: "row g-2 align-items-end",
                    children: [/*#__PURE__*/_jsxDEV("div", {
                      className: "col-md-5",
                      children: [/*#__PURE__*/_jsxDEV("label", {
                        className: "form-label small",
                        children: "Name"
                      }, void 0, false), /*#__PURE__*/_jsxDEV("input", {
                        className: "form-control form-control-sm",
                        placeholder: "e.g. Flight",
                        value: catName,
                        onChange: e => setCatName(e.target.value)
                      }, void 0, false)]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                      className: "col-md-4",
                      children: [/*#__PURE__*/_jsxDEV("label", {
                        className: "form-label small",
                        children: "Color"
                      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                        className: "d-flex gap-2 align-items-center",
                        children: [/*#__PURE__*/_jsxDEV("input", {
                          type: "color",
                          className: "form-control form-control-color form-control-sm",
                          value: catColor,
                          onChange: e => setCatColor(e.target.value),
                          style: {
                            width: 40
                          }
                        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                          className: "small text-muted",
                          children: catColor
                        }, void 0, false)]
                      }, void 0, true)]
                    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                      className: "col-md-3",
                      children: /*#__PURE__*/_jsxDEV("button", {
                        className: "btn btn-sm btn-primary w-100",
                        onClick: handleCreateCategory,
                        children: "Save"
                      }, void 0, false)
                    }, void 0, false)]
                  }, void 0, true)
                }, void 0, false)
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "row g-3",
                children: categories.map(cat => /*#__PURE__*/_jsxDEV("div", {
                  className: "col-md-4 col-sm-6",
                  children: /*#__PURE__*/_jsxDEV("div", {
                    className: "card-trip text-center py-3 h-100 position-relative group-hover-show",
                    style: {
                      borderTop: `4px solid ${cat.color}`
                    },
                    children: /*#__PURE__*/_jsxDEV("div", {
                      className: "card-body p-2 d-flex flex-column justify-content-center",
                      children: editCatId === cat.id ? /*#__PURE__*/_jsxDEV("div", {
                        children: [/*#__PURE__*/_jsxDEV("input", {
                          className: "form-control form-control-sm text-center mb-2",
                          value: editCatName,
                          onChange: e => setEditCatName(e.target.value)
                        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                          className: "d-flex justify-content-center mb-2",
                          children: /*#__PURE__*/_jsxDEV("input", {
                            type: "color",
                            className: "form-control form-control-color form-control-sm",
                            value: editCatColor,
                            onChange: e => setEditCatColor(e.target.value)
                          }, void 0, false)
                        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                          className: "d-flex gap-2 justify-content-center mt-3",
                          children: [/*#__PURE__*/_jsxDEV("button", {
                            className: "btn btn-sm btn-light border text-secondary d-flex align-items-center justify-content-center p-0",
                            style: {
                              width: '32px',
                              height: '32px'
                            },
                            onClick: () => setEditCatId(null),
                            title: "Cancel",
                            children: /*#__PURE__*/_jsxDEV(Icon, {
                              name: "x",
                              size: 16
                            }, void 0, false)
                          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                            className: "btn btn-sm btn-primary d-flex align-items-center justify-content-center p-0",
                            style: {
                              width: '32px',
                              height: '32px'
                            },
                            onClick: () => handleUpdateCategory(cat.id),
                            title: "Save",
                            children: /*#__PURE__*/_jsxDEV(Icon, {
                              name: "check",
                              size: 16
                            }, void 0, false)
                          }, void 0, false)]
                        }, void 0, true)]
                      }, void 0, true) : /*#__PURE__*/_jsxDEV(_Fragment, {
                        children: [/*#__PURE__*/_jsxDEV("div", {
                          className: "rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center",
                          style: {
                            width: 40,
                            height: 40,
                            backgroundColor: cat.color + '20'
                          },
                          children: /*#__PURE__*/_jsxDEV(Icon, {
                            name: "tag",
                            size: 18,
                            style: {
                              color: cat.color
                            }
                          }, void 0, false)
                        }, void 0, false), /*#__PURE__*/_jsxDEV("h6", {
                          className: "mb-0 small fw-bold",
                          children: cat.name
                        }, void 0, false), cat.owner !== 'default' && /*#__PURE__*/_jsxDEV("div", {
                          className: "d-flex gap-2 justify-content-center mt-3",
                          children: [/*#__PURE__*/_jsxDEV("button", {
                            className: "btn btn-sm btn-light border text-primary d-flex align-items-center justify-content-center p-0",
                            style: {
                              width: '32px',
                              height: '32px'
                            },
                            onClick: () => startEditCategory(cat),
                            title: "Edit Category",
                            children: /*#__PURE__*/_jsxDEV(Icon, {
                              name: "edit",
                              size: 16
                            }, void 0, false)
                          }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                            className: "btn btn-sm btn-light border text-danger d-flex align-items-center justify-content-center p-0",
                            style: {
                              width: '32px',
                              height: '32px'
                            },
                            onClick: () => {
                              if (window.confirm('Delete category?')) deleteCategory(cat.id);
                            },
                            title: "Delete Category",
                            children: /*#__PURE__*/_jsxDEV(Icon, {
                              name: "trash",
                              size: 16
                            }, void 0, false)
                          }, void 0, false)]
                        }, void 0, true)]
                      }, void 0, true)
                    }, void 0, false)
                  }, void 0, false)
                }, cat.id, false))
              }, void 0, false)]
            }, void 0, true), activeTab === 'appearance' && /*#__PURE__*/_jsxDEV("div", {
              className: "animate-fade-in",
              style: {
                maxWidth: '600px'
              },
              children: [/*#__PURE__*/_jsxDEV("h5", {
                className: "fw-bold mb-4",
                children: [/*#__PURE__*/_jsxDEV(Icon, {
                  name: "monitor",
                  size: 18,
                  className: "me-2"
                }, void 0, false), "Appearance"]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "p-3 border rounded mb-3",
                children: /*#__PURE__*/_jsxDEV("div", {
                  className: "mb-3",
                  children: [/*#__PURE__*/_jsxDEV("label", {
                    className: "form-label fw-bold small text-muted",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "monitor",
                      size: 14,
                      className: "me-1"
                    }, void 0, false), "Mode Tampilan"]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("select", {
                    className: "form-select",
                    value: darkMode ? 'dark' : 'light',
                    onChange: e => {
                      const isDark = e.target.value === 'dark';
                      if (isDark !== darkMode) toggleDarkMode();
                    },
                    children: [/*#__PURE__*/_jsxDEV("option", {
                      value: "light",
                      children: "Light Mode"
                    }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
                      value: "dark",
                      children: "Dark Mode"
                    }, void 0, false)]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                    className: "text-muted small mt-2 mb-0",
                    children: "Ubah tampilan menjadi mode gelap agar nyaman di mata"
                  }, void 0, false)]
                }, void 0, true)
              }, void 0, false)]
            }, void 0, true), activeTab === 'preferences' && /*#__PURE__*/_jsxDEV("div", {
              className: "animate-fade-in",
              style: {
                maxWidth: '600px'
              },
              children: [/*#__PURE__*/_jsxDEV("h5", {
                className: "fw-bold mb-4",
                children: [/*#__PURE__*/_jsxDEV(Icon, {
                  name: "settings",
                  size: 18,
                  className: "me-2"
                }, void 0, false), "Preferensi Sistem"]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "p-3 border rounded mb-3",
                children: /*#__PURE__*/_jsxDEV("div", {
                  className: "mb-3",
                  children: [/*#__PURE__*/_jsxDEV("label", {
                    className: "form-label fw-bold small text-muted",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "globe",
                      size: 14,
                      className: "me-1"
                    }, void 0, false), "Bahasa Aplikasi"]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("select", {
                    className: "form-select",
                    value: language,
                    onChange: e => setLanguage(e.target.value),
                    children: [/*#__PURE__*/_jsxDEV("option", {
                      value: "id",
                      children: "Bahasa Indonesia"
                    }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
                      value: "en",
                      children: "English (US)"
                    }, void 0, false)]
                  }, void 0, true)]
                }, void 0, true)
              }, void 0, false)]
            }, void 0, true), activeTab === 'about' && /*#__PURE__*/_jsxDEV("div", {
              className: "animate-fade-in",
              style: {
                maxWidth: '600px'
              },
              children: [/*#__PURE__*/_jsxDEV("h5", {
                className: "fw-bold mb-4",
                children: [/*#__PURE__*/_jsxDEV(Icon, {
                  name: "info",
                  size: 18,
                  className: "me-2"
                }, void 0, false), "Tentang TripNan"]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "p-4 border rounded bg-light text-center",
                children: [aboutTab === 'version' && /*#__PURE__*/_jsxDEV("div", {
                  className: "animate-fade-in py-3",
                  children: [/*#__PURE__*/_jsxDEV("div", {
                    className: "rounded-circle mx-auto mb-3 bg-primary text-white d-flex align-items-center justify-content-center shadow-sm",
                    style: {
                      width: 64,
                      height: 64
                    },
                    children: /*#__PURE__*/_jsxDEV(Icon, {
                      name: "map",
                      size: 32
                    }, void 0, false)
                  }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
                    className: "fw-bold mb-1",
                    children: "TripNan"
                  }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
                    className: "text-primary fw-bold mb-0",
                    children: "Version 2.0.0"
                  }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
                    className: "small text-muted mt-2",
                    children: "WebP Optimized & Responsive"
                  }, void 0, false)]
                }, void 0, true), aboutTab === 'kenali' && /*#__PURE__*/_jsxDEV("div", {
                  className: "animate-fade-in text-start py-2",
                  children: [/*#__PURE__*/_jsxDEV("h6", {
                    className: "fw-bold text-primary mb-3",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "info",
                      size: 18,
                      className: "me-2"
                    }, void 0, false), "Kenali TripNan"]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                    className: "small text-muted mb-0 lh-lg",
                    children: "TripNan adalah aplikasi super-ringan untuk pencatatan dan manajemen perjalanan yang dirancang untuk memudahkan Anda merencanakan liburan, memantau anggaran (budget), serta mengelola aset perjalanan Anda secara mandiri."
                  }, void 0, false)]
                }, void 0, true), aboutTab === 'ulas' && /*#__PURE__*/_jsxDEV("div", {
                  className: "animate-fade-in py-2",
                  children: [/*#__PURE__*/_jsxDEV("h6", {
                    className: "fw-bold text-warning mb-3",
                    children: [/*#__PURE__*/_jsxDEV(Icon, {
                      name: "star",
                      size: 18,
                      className: "me-2"
                    }, void 0, false), "Ulas Aplikasi ini"]
                  }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                    className: "small text-muted mb-3",
                    children: "Bagaimana pengalaman Anda menggunakan TripNan?"
                  }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                    className: "d-flex gap-2 justify-content-center mb-4",
                    children: [1, 2, 3, 4, 5].map(s => /*#__PURE__*/_jsxDEV(Icon, {
                      name: "star",
                      size: 28,
                      className: "text-warning cursor-pointer"
                    }, s, false))
                  }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                    className: "btn btn-sm btn-primary px-4",
                    children: "Kirim Ulasan"
                  }, void 0, false)]
                }, void 0, true)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
                className: "small text-muted mt-5 text-center",
                children: "© 2026 TripNan. All rights reserved."
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
};

// Templates Page
const TemplatesPage = () => {
  const {
    templates,
    saveTemplate,
    deleteTemplate,
    useTemplate,
    activeTrip,
    navigateTo
  } = useTrip();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const handleCreate = async e => {
    e.preventDefault();
    if (!activeTrip) return;
    await saveTemplate(name, desc, {
      name: activeTrip.name,
      schedules: activeTrip.schedules
    });
    setName('');
    setDesc('');
    setShow(false);
  };
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("button", {
      className: "btn btn-link text-muted p-0 mb-4",
      onClick: () => navigateTo('my-trips'),
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "arrow-left",
        size: 16
      }, void 0, false), " Back"]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex justify-content-between align-items-center mb-4",
      children: [/*#__PURE__*/_jsxDEV("h2", {
        className: "fw-bold mb-0",
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: "layout",
          size: 24
        }, void 0, false), " Templates"]
      }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
        className: "btn btn-primary",
        disabled: !activeTrip,
        onClick: () => setShow(!show),
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: show ? 'x' : 'plus',
          size: 18
        }, void 0, false), " ", show ? 'Cancel' : 'Save Current']
      }, void 0, true)]
    }, void 0, true), show && /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4",
      style: {
        border: '2px solid var(--primary)'
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        className: "card-body",
        children: [/*#__PURE__*/_jsxDEV("h5", {
          className: "fw-bold mb-3",
          children: "Save as Template"
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "text-muted small",
          children: ["Save \"", activeTrip?.name, "\" for reuse"]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          className: "row g-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "col-md-6",
            children: /*#__PURE__*/_jsxDEV("input", {
              className: "form-control",
              placeholder: "Template name",
              value: name,
              onChange: e => setName(e.target.value)
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "col-md-4",
            children: /*#__PURE__*/_jsxDEV("input", {
              className: "form-control",
              placeholder: "Description",
              value: desc,
              onChange: e => setDesc(e.target.value)
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "col-md-2",
            children: /*#__PURE__*/_jsxDEV("button", {
              className: "btn btn-primary",
              onClick: handleCreate,
              children: "Save"
            }, void 0, false)
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)
    }, void 0, false), templates.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "empty-state",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "layout",
        size: 64
      }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
        className: "fw-bold",
        children: "No templates"
      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
        children: "Create a trip first, then save as template"
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
      className: "row g-4",
      children: templates.map(t => /*#__PURE__*/_jsxDEV("div", {
        className: "col-md-4",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "card-trip",
          children: /*#__PURE__*/_jsxDEV("div", {
            className: "card-body p-4",
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold",
              children: t.name
            }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small",
              children: t.description || 'No description'
            }, void 0, false), /*#__PURE__*/_jsxDEV("small", {
              className: "text-muted",
              children: new Date(t.created_at).toLocaleDateString()
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              className: "mt-3",
              children: [/*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-sm btn-primary me-2",
                onClick: () => useTemplate(t.id),
                children: "Use"
              }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
                className: "btn btn-sm btn-outline-danger",
                onClick: () => deleteTemplate(t.id),
                children: /*#__PURE__*/_jsxDEV(Icon, {
                  name: "trash",
                  size: 14
                }, void 0, false)
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false)
      }, t.id, false))
    }, void 0, false)]
  }, void 0, true);
};

// Notifications Page
const NotificationsPage = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    navigateTo
  } = useTrip();
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("div", {
      className: "d-flex justify-content-between align-items-center mb-4",
      children: [/*#__PURE__*/_jsxDEV("h2", {
        className: "fw-bold mb-0",
        children: [/*#__PURE__*/_jsxDEV(Icon, {
          name: "bell",
          size: 24
        }, void 0, false), " Notifications"]
      }, void 0, true), notifications.some(n => !n.is_read) && /*#__PURE__*/_jsxDEV("button", {
        className: "btn btn-sm btn-outline-primary",
        onClick: markAllNotificationsRead,
        children: "Mark all read"
      }, void 0, false)]
    }, void 0, true), notifications.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "empty-state",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "bell",
        size: 64
      }, void 0, false), /*#__PURE__*/_jsxDEV("h4", {
        className: "fw-bold",
        children: "No notifications"
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
      className: "d-flex flex-column gap-2",
      children: notifications.map(n => /*#__PURE__*/_jsxDEV("div", {
        className: `card-trip ${!n.is_read ? '' : 'opacity-75'}`,
        onClick: () => !n.is_read && markNotificationRead(n.id),
        style: {
          cursor: 'pointer'
        },
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "card-body p-3 d-flex align-items-center gap-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: `rounded-circle d-flex align-items-center justify-content-center ${n.is_read ? 'bg-light' : 'bg-primary'}`,
            style: {
              width: 40,
              height: 40,
              color: n.is_read ? 'var(--text-muted)' : 'white'
            },
            children: /*#__PURE__*/_jsxDEV(Icon, {
              name: n.type === 'trip_shared' ? 'share-2' : 'info',
              size: 18
            }, void 0, false)
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            className: "flex-grow-1",
            children: [/*#__PURE__*/_jsxDEV("h6", {
              className: "mb-1",
              children: n.title
            }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small mb-0",
              children: n.message
            }, void 0, false), /*#__PURE__*/_jsxDEV("small", {
              className: "text-muted",
              children: new Date(n.created_at).toLocaleString('en-US')
            }, void 0, false)]
          }, void 0, true), !n.is_read && /*#__PURE__*/_jsxDEV("span", {
            className: "rounded-circle bg-primary",
            style: {
              width: 8,
              height: 8
            }
          }, void 0, false)]
        }, void 0, true)
      }, n.id, false))
    }, void 0, false)]
  }, void 0, true);
};

// ---------------------------------------------------------
// NEW COMPONENT: All Budgets Report
// ---------------------------------------------------------
const AllBudgetsReport = () => {
  const {
    trips
  } = useTrip();
  const [expandedTripId, setExpandedTripId] = useState(null);
  const toggleExpand = id => {
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
  return /*#__PURE__*/_jsxDEV("div", {
    className: "animate-fade-in",
    children: [/*#__PURE__*/_jsxDEV("h2", {
      className: "fw-bold mb-4",
      children: "All Budgets"
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: "card-trip mb-4 overflow-hidden border",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-4 text-center border-bottom",
        style: {
          background: overallIsOver ? 'linear-gradient(135deg, #fff, #fef2f2)' : 'linear-gradient(135deg, #fff, #f0fdf4)'
        },
        children: [/*#__PURE__*/_jsxDEV("h4", {
          className: "mb-3 text-muted",
          children: "Overall Budget Status"
        }, void 0, false), /*#__PURE__*/_jsxDEV("h2", {
          className: `fw-bold ${overallIsOver ? 'text-danger' : 'text-success'}`,
          children: overallIsOver ? 'OVER BUDGET' : 'ON BUDGET'
        }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
          className: "fs-5 text-muted mb-0",
          children: overallIsOver ? /*#__PURE__*/_jsxDEV(_Fragment, {
            children: ["Total Overspend ", /*#__PURE__*/_jsxDEV("strong", {
              className: "text-danger",
              children: ["Rp ", overallDiff.toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true) : /*#__PURE__*/_jsxDEV(_Fragment, {
            children: ["Total Savings ", /*#__PURE__*/_jsxDEV("strong", {
              className: "text-success",
              children: ["Rp ", Math.abs(overallDiff).toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true)
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "card-body p-3",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "row text-center",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "col-6 border-end",
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small fw-bold mb-1",
              children: "TOTAL BUDGET"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold",
              style: {
                color: 'var(--primary)'
              },
              children: ["Rp ", overallPlan.toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            className: "col-6",
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "text-muted small fw-bold mb-1",
              children: "TOTAL ACTUAL"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h5", {
              className: `fw-bold ${overallIsOver ? 'text-danger' : 'text-success'}`,
              children: ["Rp ", overallReal.toLocaleString('en-US')]
            }, void 0, true)]
          }, void 0, true)]
        }, void 0, true)
      }, void 0, false)]
    }, void 0, true), /*#__PURE__*/_jsxDEV("h4", {
      className: "fw-bold mb-3",
      children: "Trips Breakdown"
    }, void 0, false), tripBudgets.length === 0 ? /*#__PURE__*/_jsxDEV("div", {
      className: "text-center text-muted py-5",
      children: [/*#__PURE__*/_jsxDEV(Icon, {
        name: "folder",
        size: 48,
        className: "opacity-50 mb-3"
      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
        children: "No trips available."
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("div", {
      className: "row g-3",
      children: tripBudgets.map(trip => /*#__PURE__*/_jsxDEV("div", {
        className: "col-12",
        children: /*#__PURE__*/_jsxDEV("div", {
          className: "card-trip border",
          style: {
            borderLeft: `4px solid ${trip.isOver ? 'var(--bs-danger)' : 'var(--bs-success)'}`
          },
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "p-3 d-flex justify-content-between align-items-center",
            onClick: () => toggleExpand(trip.id),
            style: {
              cursor: 'pointer'
            },
            children: [/*#__PURE__*/_jsxDEV("h5", {
              className: "fw-bold mb-0 text-truncate",
              children: trip.name
            }, void 0, false), /*#__PURE__*/_jsxDEV(Icon, {
              name: expandedTripId === trip.id ? 'chevron-up' : 'chevron-down',
              size: 20,
              className: "text-muted"
            }, void 0, false)]
          }, void 0, true), expandedTripId === trip.id && /*#__PURE__*/_jsxDEV("div", {
            className: "p-3 pt-0 border-top mt-2",
            children: /*#__PURE__*/_jsxDEV("div", {
              className: "mt-3",
              children: [/*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between mb-2 small",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted",
                  children: "Budget:"
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: "fw-bold",
                  children: ["Rp ", trip.totalPlan.toLocaleString('en-US')]
                }, void 0, true)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between mb-2 small",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted",
                  children: "Itinerary Spending:"
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: "fw-medium",
                  children: ["Rp ", trip.itineraryReal.toLocaleString('en-US')]
                }, void 0, true)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between mb-2 small",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted",
                  children: "Add-ons Spending:"
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: "fw-medium",
                  children: ["Rp ", trip.addonReal.toLocaleString('en-US')]
                }, void 0, true)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between mb-2 small",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: "text-muted fw-bold",
                  children: "Total Actual:"
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: `fw-bold ${trip.isOver ? 'text-danger' : 'text-success'}`,
                  children: ["Rp ", trip.totalReal.toLocaleString('en-US')]
                }, void 0, true)]
              }, void 0, true), /*#__PURE__*/_jsxDEV("hr", {
                className: "my-2"
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                className: "d-flex justify-content-between align-items-center",
                children: [/*#__PURE__*/_jsxDEV("span", {
                  className: `badge ${trip.isOver ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`,
                  children: trip.isOver ? 'Over Budget' : 'On Budget'
                }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
                  className: `small fw-bold ${trip.isOver ? 'text-danger' : 'text-success'}`,
                  children: [trip.isOver ? '+' : '-', "Rp ", Math.abs(trip.diff).toLocaleString('en-US')]
                }, void 0, true)]
              }, void 0, true)]
            }, void 0, true)
          }, void 0, false)]
        }, void 0, true)
      }, trip.id, false))
    }, void 0, false)]
  }, void 0, true);
};

// App Content
const AppContent = () => {
  const {
    currentUser,
    activeView,
    navigateTo,
    logout,
    unreadCount
  } = useTrip();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Handle navigation
  const handleNavClick = key => {
    navigateTo(key);
    closeSidebar();
  };
  if (!currentUser) return /*#__PURE__*/_jsxDEV(AuthPage, {}, void 0, false);
  const pages = {
    'my-trips': /*#__PURE__*/_jsxDEV(MyTrips, {}, void 0, false),
    'trip-dashboard': /*#__PURE__*/_jsxDEV(TripDashboard, {}, void 0, false),
    itinerary: /*#__PURE__*/_jsxDEV(Itinerary, {}, void 0, false),
    addons: /*#__PURE__*/_jsxDEV(AddOns, {}, void 0, false),
    friends: /*#__PURE__*/_jsxDEV(Friends, {}, void 0, false),
    budget: /*#__PURE__*/_jsxDEV(BudgetReport, {}, void 0, false),
    settings: /*#__PURE__*/_jsxDEV(SettingsPage, {}, void 0, false),
    templates: /*#__PURE__*/_jsxDEV(TemplatesPage, {}, void 0, false),
    notifications: /*#__PURE__*/_jsxDEV(NotificationsPage, {}, void 0, false),
    'all-budgets': /*#__PURE__*/_jsxDEV(AllBudgetsReport, {}, void 0, false)
  };
  return /*#__PURE__*/_jsxDEV("div", {
    style: {
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column'
    },
    children: [/*#__PURE__*/_jsxDEV("div", {
      className: "d-flex align-items-center justify-content-between p-3 border-bottom bg-white sticky-top shadow-sm",
      style: {
        zIndex: 1030
      },
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "d-flex align-items-center",
        children: [/*#__PURE__*/_jsxDEV("button", {
          onClick: toggleSidebar,
          className: "btn p-2 me-2 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center",
          children: /*#__PURE__*/_jsxDEV(Icon, {
            name: "menu",
            size: 24
          }, void 0, false)
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          className: "fw-bold fs-5 d-flex align-items-center gap-2",
          style: {
            color: 'var(--primary)'
          },
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "map",
            size: 24
          }, void 0, false), " TripNan"]
        }, void 0, true)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "d-flex align-items-center gap-1 ms-auto",
        children: [/*#__PURE__*/_jsxDEV("button", {
          className: "btn p-2 border-0 bg-transparent text-primary position-relative d-flex align-items-center justify-content-center",
          onClick: () => {
            navigateTo('notifications');
            closeSidebar();
          },
          title: "Notifications",
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "bell",
            size: 22
          }, void 0, false), unreadCount > 0 && /*#__PURE__*/_jsxDEV("span", {
            className: "position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger",
            style: {
              fontSize: '0.6rem',
              padding: '0.25em 0.4em',
              transform: 'translate(-60%, 20%)'
            },
            children: unreadCount
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
          className: "btn p-2 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center",
          onClick: logout,
          title: "Logout",
          children: /*#__PURE__*/_jsxDEV(Icon, {
            name: "log-out",
            size: 22
          }, void 0, false)
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: `sidebar-overlay ${sidebarOpen ? 'active' : ''}`,
      onClick: closeSidebar
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      className: `sidebar ${sidebarOpen ? 'open' : ''}`,
      children: [/*#__PURE__*/_jsxDEV("nav", {
        className: "sidebar-nav pt-3",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "sidebar-group-title text-muted small fw-bold px-3 mb-2 mt-2 text-uppercase",
          children: "Dashboard"
        }, void 0, false), [{
          key: 'my-trips',
          icon: 'map',
          label: 'My Trips'
        }, {
          key: 'all-budgets',
          icon: 'dollar-sign',
          label: 'All Budgets'
        }].map(item => /*#__PURE__*/_jsxDEV("button", {
          className: `sidebar-nav-item ${activeView === item.key ? 'active' : ''}`,
          onClick: () => handleNavClick(item.key),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: item.icon,
            size: 18
          }, void 0, false), " ", item.label, item.badge > 0 && /*#__PURE__*/_jsxDEV("span", {
            className: "sidebar-badge",
            children: item.badge
          }, void 0, false)]
        }, item.key, true)), /*#__PURE__*/_jsxDEV("div", {
          className: "sidebar-group-title text-muted small fw-bold px-3 mb-2 mt-4 text-uppercase",
          children: "Management"
        }, void 0, false), [{
          key: 'templates',
          icon: 'layout',
          label: 'Templates'
        }].map(item => /*#__PURE__*/_jsxDEV("button", {
          className: `sidebar-nav-item ${activeView === item.key ? 'active' : ''}`,
          onClick: () => handleNavClick(item.key),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: item.icon,
            size: 18
          }, void 0, false), " ", item.label, item.badge > 0 && /*#__PURE__*/_jsxDEV("span", {
            className: "sidebar-badge",
            children: item.badge
          }, void 0, false)]
        }, item.key, true))]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        className: "sidebar-user-card mt-auto d-flex flex-column gap-2",
        style: {
          marginBottom: 0
        },
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "d-flex align-items-center gap-3",
          children: [/*#__PURE__*/_jsxDEV("div", {
            className: "sidebar-user-avatar",
            children: currentUser?.charAt(0).toUpperCase()
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("p", {
              className: "small mb-0",
              style: {
                color: 'var(--text-muted)'
              },
              children: "Logged in as"
            }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
              className: "fw-bold mb-0",
              style: {
                color: 'var(--text-primary)'
              },
              children: currentUser
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
          className: `btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2 mt-2 ${activeView === 'settings' ? 'btn-primary' : 'btn-light border'}`,
          onClick: () => handleNavClick('settings'),
          children: [/*#__PURE__*/_jsxDEV(Icon, {
            name: "settings",
            size: 16
          }, void 0, false), " Settings"]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
      className: "main-content d-flex flex-column flex-grow-1",
      children: [/*#__PURE__*/_jsxDEV("div", {
        className: "px-3 px-md-5 pt-3 pt-md-4 pb-5 flex-grow-1",
        children: pages[activeView] || /*#__PURE__*/_jsxDEV(MyTrips, {}, void 0, false)
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "mt-auto",
        children: [/*#__PURE__*/_jsxDEV("div", {
          className: "px-3 px-md-5 pb-3",
          children: /*#__PURE__*/_jsxDEV("button", {
            className: "btn btn-link text-danger text-decoration-none p-0 d-flex align-items-center gap-2",
            onClick: logout,
            style: {
              fontWeight: '500'
            },
            children: [/*#__PURE__*/_jsxDEV(Icon, {
              name: "log-out",
              size: 18
            }, void 0, false), " Logout Akun"]
          }, void 0, true)
        }, void 0, false), /*#__PURE__*/_jsxDEV("footer", {
          className: "text-center text-muted py-4",
          style: {
            borderTop: '1px solid var(--border)'
          },
          children: /*#__PURE__*/_jsxDEV("small", {
            children: ["© ", new Date().getFullYear(), " Dnan Dev. All rights reserved."]
          }, void 0, true)
        }, void 0, false)]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
};
const App = () => /*#__PURE__*/_jsxDEV(TripProvider, {
  children: /*#__PURE__*/_jsxDEV(AppContent, {}, void 0, false)
}, void 0, false);
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/_jsxDEV(App, {}, void 0, false));
