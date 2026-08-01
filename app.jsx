const { useState, useEffect, createContext, useContext } = React;

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
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('my-trips');
  const [activeTripId, setActiveTripId] = useState(null);

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
    setCurrentUser(null);
    setActiveView('my-trips');
    setActiveTripId(null);
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
    const newSch = { ...schedule, id: generateId(), trip_id: activeTripId, photos: [] };
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

  const removeFriend = async (id) => {
    setTrips(trips.map(t => t.id === activeTripId ? { ...t, friends: t.friends.filter(f => f.id !== id) } : t));
    fetchAPI('delete_friend', { id });
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
    joinTrip,
    exportTrip, importTrip,
    saveTemplate, deleteTemplate, useTemplate,
    createCategory, deleteCategory,
    updateProfile,
    markNotificationRead, markAllNotificationsRead,
    navigateTo, activeView
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

// Icons
const icons = {
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
  'chevron-up': '<polyline points="18 15 12 9 6 15"/>'
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
            <img src={photo} alt={`Photo ${i + 1}`} />
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

// My Trips Page
const MyTrips = () => {
  const { trips, createTrip, joinTrip, navigateTo, isLoading, categories, logout, unreadCount, currentUser } = useTrip();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [newTrip, setNewTrip] = useState({ name: '', budget: '', category_id: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [coverPreview, setCoverPreview] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list or grid

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

  if (isLoading) return <div className="text-center p-5"><Icon name="loader" size={24} className="spin me-2" /> Loading...</div>;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  return (
    <div className="animate-fade-in">
      <div className="row align-items-center mb-4 gap-3 gap-md-0">
        <div className="col-12 col-md-auto">
          <h4 className="text-muted mb-2 fw-normal">{getGreeting()}, <span className="fw-bold" style={{ color: 'var(--primary)' }}>{currentUser}</span>!</h4>
          <h1 className="h3 fw-bold mb-1">My Trips</h1>
          <p className="text-muted mb-0">{trips.length} trips planned</p>
        </div>
        <div className="col-12 col-md d-flex justify-content-md-end flex-wrap gap-2">
          <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 'auto', flexGrow: 1 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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
          <div className="btn-group border bg-white rounded-3 shadow-sm d-flex" style={{ padding: '2px' }}>
            <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted border-0'}`} onClick={() => setViewMode('grid')} style={{ padding: '6px 12px' }} title="Grid View">
              <Icon name="grid" size={16} />
            </button>
            <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-light border shadow-sm rounded-2 text-primary' : 'btn-white text-muted border-0'}`} onClick={() => setViewMode('list')} style={{ padding: '6px 12px' }} title="List View">
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
          <div className="d-flex gap-2 justify-content-center mt-2">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Icon name="plus" size={16} /> Create Trip</button>
            <button className="btn btn-outline-primary" onClick={() => setShowJoin(true)}><Icon name="user-plus" size={16} /> Join Trip</button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filtered.map(trip => {
            const completed = trip.schedules?.filter(s => s.isCompleted).length || 0;
            const total = trip.schedules?.length || 0;
            const progress = total ? Math.round((completed / total) * 100) : 0;
            const cat = categories.find(c => c.id === trip.category_id);
            return (
              <div key={trip.id} className={viewMode === 'grid' ? 'col-6 col-md-4' : 'col-12'}>
                <div className="card-trip trip-card" onClick={() => navigateTo('trip-dashboard', trip.id)}>
                  <div className="trip-cover" style={{ backgroundImage: trip.coverUrl ? `url(${trip.coverUrl})` : 'linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%)' }}>
                    <span className="trip-code">{trip.tripCode}</span>
                    {!trip.isOwner && <span className="trip-shared-badge">Shared</span>}
                    {cat && (
                      <span className="badge" style={{ position: 'absolute', bottom: 12, left: 12, background: cat.color, color: 'white' }}>{cat.name}</span>
                    )}
                  </div>
                  <div className="card-body">
                    <h5 className="fw-bold mb-1">{trip.name}</h5>
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
          </div>
          <h1 className="h2 fw-bold mb-1 text-dark">{activeTrip.name}</h1>
          <p className="text-muted mb-0" style={{ fontSize: '1.1rem' }}>
            Budget: <span className="fw-medium text-dark">Rp {parseFloat(activeTrip.totalPlanBudget).toLocaleString('en-US')}</span>
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-light border d-flex align-items-center gap-2 px-3" onClick={() => { setEdit(activeTrip); setEditing(true) }}>
            <Icon name="edit" size={16} /> Edit
          </button>
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
          { key: 'itinerary', icon: 'calendar', color: 'var(--primary)', title: 'Itinerary', desc: `${activeTrip.schedules?.length || 0} activities` },
          { key: 'friends', icon: 'users', color: 'var(--success)', title: 'Travel Buddies', desc: `${activeTrip.friends?.length || 0} friends` },
          { key: 'budget', icon: 'pie-chart', color: 'var(--warning)', title: 'Budget Report', desc: 'View analytics' }
        ].map(m => (
          <div key={m.key} className="col-md-4">
            <div className="module-card" onClick={() => navigateTo(m.key)}>
              <div className="module-icon" style={{ background: m.color }}><Icon name={m.icon} size={28} /></div>
              <h4 className="fw-bold mb-1">{m.title}</h4>
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

  const sorted = [...(activeTrip.schedules || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('trip-dashboard')}><Icon name="arrow-left" size={16} /> Back</button>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div><h2 className="fw-bold mb-1">Itinerary</h2><p className="text-muted mb-0">Plan your activities</p></div>
        <button className={`btn ${showAdd ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowAdd(!showAdd)}>
          <Icon name={showAdd ? 'x' : 'plus'} size={16} /> {showAdd ? 'Cancel' : 'Add Activity'}
        </button>
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
              <button type="submit" className="btn btn-primary mt-3">Save Activity</button>
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
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}>Save</button>
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
                    <button className="btn btn-success btn-sm" onClick={handleComplete}>Confirm</button>
                    <button className="btn btn-outline-secondary btn-sm ms-2" onClick={() => setShowComplete(false)}>Cancel</button>
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
                      <button className="btn btn-danger btn-sm px-2 py-0" onClick={() => deleteSchedule(schedule.id)}>Ya</button>
                      <button className="btn btn-secondary btn-sm px-2 py-0" onClick={() => setShowDeleteConfirm(false)}>Tidak</button>
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
                    <button className="btn btn-danger btn-sm px-2 py-0" onClick={() => deleteSchedule(schedule.id)}>Ya</button>
                    <button className="btn btn-secondary btn-sm px-2 py-0" onClick={() => setShowDeleteConfirm(false)}>Tidak</button>
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
                <button type="submit" className="btn btn-success w-100">Add Friend</button>
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
  const totalPlan = schedules.reduce((a, c) => a + parseFloat(c.planBudget || 0), 0);
  const totalReal = schedules.filter(s => s.isCompleted).reduce((a, c) => a + parseFloat(c.realBudget || 0), 0);
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
              <p className="text-muted small fw-bold mb-2">PLANNED</p>
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

// Profile Page
const ProfilePage = () => {
  const { currentUser, navigateTo } = useTrip();
  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('my-trips')}><Icon name="arrow-left" size={16} /> Back</button>
      <h2 className="fw-bold mb-4"><Icon name="user" size={24} /> My Profile</h2>
      <div className="card-trip">
        <div className="card-body p-4 text-center">
          <div className="rounded-circle bg-primary d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 80, height: 80 }}>
            <span style={{ fontSize: 32, color: 'white', fontWeight: 'bold' }}>{currentUser?.charAt(0).toUpperCase()}</span>
          </div>
          <h4 className="fw-bold">{currentUser}</h4>
          <p className="text-muted">Profile settings coming soon</p>
        </div>
      </div>
    </div>
  );
};

// Categories Page
const CategoriesPage = () => {
  const { categories, createCategory, deleteCategory, navigateTo } = useTrip();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const handleCreate = async (e) => {
    e.preventDefault();
    await createCategory(name, color, 'tag');
    setName('');
    setShow(false);
  };

  return (
    <div className="animate-fade-in">
      <button className="btn btn-link text-muted p-0 mb-4" onClick={() => navigateTo('my-trips')}><Icon name="arrow-left" size={16} /> Back</button>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold mb-0"><Icon name="tag" size={24} /> Categories</h2>
        <button className="btn btn-primary" onClick={() => setShow(!show)}><Icon name={show ? 'x' : 'plus'} size={18} /> {show ? 'Cancel' : 'New'}</button>
      </div>
      {show && (
        <div className="card-trip mb-4" style={{ border: '2px solid var(--primary)' }}>
          <div className="card-body">
            <h5 className="fw-bold mb-3">Create Category</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <input className="form-control" placeholder="Category name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="col-md-4">
                <div className="d-flex align-items-center gap-2">
                  <input type="color" className="form-control form-control-color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 50 }} />
                  <span className="text-muted small">{color}</span>
                </div>
              </div>
              <div className="col-md-2">
                <button className="btn btn-primary" onClick={handleCreate}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="row g-3">
        {categories.map(cat => (
          <div key={cat.id} className="col-md-3 col-6">
            <div className="card-trip text-center py-4" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <div className="card-body">
                <div className="rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, backgroundColor: cat.color + '20' }}>
                  <Icon name="tag" size={20} style={{ color: cat.color }} />
                </div>
                <h6 className="mb-0">{cat.name}</h6>
                {cat.owner !== 'default' && (
                  <button className="btn btn-sm text-danger p-0 mt-2" onClick={() => deleteCategory(cat.id)}><Icon name="trash" size={14} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
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
                <button className="btn btn-primary" onClick={handleCreate}>Save</button>
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
                    <button className="btn btn-sm btn-primary me-2" onClick={() => useTemplate(t.id)}>Use</button>
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
          <button className="btn btn-sm btn-outline-primary" onClick={markAllNotificationsRead}>Mark all read</button>
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

// App Content
const AppContent = () => {
  const { currentUser, activeView, navigateTo, logout, unreadCount } = useTrip();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Handle navigation
  const handleNavClick = (key) => {
    navigateTo(key);
    closeSidebar();
  };

  if (!currentUser) return <AuthPage />;

  const pages = {
    'my-trips': <MyTrips />,
    'trip-dashboard': <TripDashboard />,
    itinerary: <Itinerary />,
    friends: <Friends />,
    budget: <BudgetReport />,
    profile: <ProfilePage />,
    categories: <CategoriesPage />,
    templates: <TemplatesPage />,
    notifications: <NotificationsPage />
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Global Header */}
      <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-white sticky-top shadow-sm" style={{ zIndex: 1030 }}>
        <div className="d-flex align-items-center">
          <button onClick={toggleSidebar} className="btn p-2 me-2 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center d-md-none">
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
        <nav className="sidebar-nav pt-3">
          {[
            { key: 'my-trips', icon: 'map', label: 'My Trips' },
            { key: 'profile', icon: 'user', label: 'Profile' },
            { key: 'categories', icon: 'tag', label: 'Categories' },
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

        <div className="sidebar-user-card mt-auto" style={{ marginBottom: 0 }}>
          <div className="d-flex align-items-center gap-3">
            <div className="sidebar-user-avatar">{currentUser?.charAt(0).toUpperCase()}</div>
            <div>
              <p className="small mb-0" style={{ color: 'var(--text-muted)' }}>Logged in as</p>
              <p className="fw-bold mb-0" style={{ color: 'var(--text-primary)' }}>{currentUser}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content d-flex flex-column flex-grow-1">
        <div className="px-3 px-md-5 pt-3 pt-md-4 pb-5 flex-grow-1">
          {pages[activeView] || <MyTrips />}
        </div>
        
        {/* Footer */}
        <footer className="text-center text-muted py-4 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
          <small>&copy; {new Date().getFullYear()} Dnan Dev. All rights reserved.</small>
        </footer>
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
