// Service Worker محدث لتطبيق كلاشي PWA - إصدار 3.0.0
const CACHE_NAME = 'clashy-pwa-v3.0.0';
const STATIC_CACHE_NAME = 'clashy-static-v3.0.0';
const DYNAMIC_CACHE_NAME = 'clashy-dynamic-v3.0.0';

// الموارد الأساسية للتطبيق
const STATIC_ASSETS = [
  '/Clashy/',
  '/Clashy/index.html',
  '/Clashy/alhajami.html',
  '/Clashy/Al%20Ghadeer%20Office.html',
  '/Clashy/offline.html',
  '/Clashy/manifest.json'
];

// الموارد الخارجية المهمة
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// الصور الافتراضية للمنتجات
const DEFAULT_IMAGES = [
  'https://via.placeholder.com/300x200/8B5CF6/white?text=شال+تركي+فاخر',
  'https://via.placeholder.com/300x200/06B6D4/white?text=هاتف+ذكي',
  'https://via.placeholder.com/300x200/F59E0B/white?text=طرحة+حريرية',
  'https://via.placeholder.com/300x200/10B981/white?text=سماعات',
  'https://via.placeholder.com/300x200/EC4899/white?text=كوفية',
  'https://via.placeholder.com/300x200/6366F1/white?text=ساعة+ذكية'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('🔧 SW v3.0.0: تثبيت Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // تخزين الموارد الأساسية
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('📦 SW: تخزين الموارد الأساسية...');
        return cache.addAll(STATIC_ASSETS).catch(error => {
          console.warn('⚠️ SW: فشل في تخزين بعض الموارد الأساسية:', error);
          // محاولة تخزين كل مورد على حدة
          return Promise.allSettled(
            STATIC_ASSETS.map(url => cache.add(url).catch(err => {
              console.warn(`⚠️ SW: فشل تخزين ${url}:`, err);
            }))
          );
        });
      }),
      
      // تخزين الموارد الخارجية
      caches.open(DYNAMIC_CACHE_NAME).then(cache => {
        console.log('🌐 SW: تخزين الموارد الخارجية...');
        return Promise.allSettled([
          ...EXTERNAL_ASSETS.map(url => 
            fetch(url, { mode: 'cors' })
              .then(response => response.ok ? cache.put(url, response) : null)
              .catch(error => console.warn(`⚠️ SW: فشل تخزين ${url}:`, error))
          ),
          ...DEFAULT_IMAGES.map(url =>
            fetch(url)
              .then(response => response.ok ? cache.put(url, response) : null)
              .catch(error => console.warn(`⚠️ SW: فشل تخزين صورة ${url}:`, error))
          )
        ]);
      })
    ])
    .then(() => {
      console.log('✅ SW: تم التثبيت بنجاح');
      return self.skipWaiting();
    })
    .catch(error => {
      console.error('❌ SW: خطأ في التثبيت:', error);
    })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('⚡ SW v3.0.0: تفعيل Service Worker...');
  
  event.waitUntil(
    Promise.all([
      // مسح التخزين المؤقت القديم
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName.startsWith('clashy-')) {
              console.log('🗑️ SW: حذف cache قديم:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // السيطرة على جميع العملاء
      self.clients.claim()
    ])
    .then(() => {
      console.log('✅ SW: تم التفعيل بنجاح');
      
      // إشعار العملاء بالتحديث
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: '3.0.0',
            message: 'Service Worker activated successfully'
          });
        });
      });
    })
    .catch(error => {
      console.error('❌ SW: خطأ في التفعيل:', error);
    })
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') {
    return;
  }

  // تجاهل الطلبات الخاصة
  const url = new URL(event.request.url);
  if (url.protocol === 'chrome-extension:' || 
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.pathname.includes('/wp-admin/') ||
      url.pathname.includes('/api/auth/')) {
    return;
  }

  event.respondWith(handleRequest(event.request));
});

// معالجة الطلبات الذكية
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // الصفحات الرئيسية - Cache First
    if (isNavigationRequest(request) || isStaticAsset(request)) {
      return await cacheFirstStrategy(request);
    }
    
    // الموارد الخارجية - Stale While Revalidate
    if (isExternalAsset(request)) {
      return await staleWhileRevalidateStrategy(request);
    }
    
    // APIs - Network First
    if (isAPIRequest(request)) {
      return await networkFirstStrategy(request);
    }
    
    // الصور - Cache First مع Fallback
    if (isImageRequest(request)) {
      return await handleImageRequest(request);
    }
    
    // الطلبات الأخرى - Network First مع Cache Fallback
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.error('❌ SW: خطأ في معالجة الطلب:', error);
    return await getOfflineResponse(request);
  }
}

// استراتيجية Cache First - للموارد الثابتة
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('📦 SW: تحميل من Cache:', request.url);
      
      // تحديث في الخلفية
      updateInBackground(request);
      return cachedResponse;
    }
    
    // جلب من الشبكة وتخزين
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('💾 SW: تخزين جديد:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.warn('⚠️ SW: Cache First فشل:', error);
    throw error;
  }
}

// استراتيجية Network First - للبيانات الديناميكية
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('🌐 SW: تحديث من الشبكة:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('📦 SW: تحميل من Cache (Network فشل):', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// استراتيجية Stale While Revalidate - للموارد الخارجية
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  // تحديث في الخلفية
  const networkResponsePromise = fetch(request)
    .then(response => {
      if (response.ok) {
        const cache = caches.open(DYNAMIC_CACHE_NAME);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(error => {
      console.warn('⚠️ SW: فشل تحديث خلفي:', error);
    });
  
  // إرجاع النسخة المخزنة فوراً أو انتظار الشبكة
  return cachedResponse || networkResponsePromise;
}

// معالجة طلبات الصور
async function handleImageRequest(request) {
  try {
    // التحقق من التخزين المؤقت أولاً
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // محاولة جلب من الشبكة
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.warn('⚠️ SW: فشل تحميل الصورة، استخدام الافتراضية:', error);
    
    // إرجاع صورة افتراضية SVG
    return new Response(
      createDefaultImageSVG(),
      { 
        headers: { 
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'max-age=86400'
        } 
      }
    );
  }
}

// تحديث في الخلفية
function updateInBackground(request) {
  // تحديث بدون انتظار
  fetch(request)
    .then(response => {
      if (response.ok) {
        const cache = caches.open(STATIC_CACHE_NAME);
        cache.then(c => c.put(request, response));
      }
    })
    .catch(error => {
      console.warn('⚠️ SW: فشل التحديث الخلفي:', error);
    });
}

// إنشاء صورة افتراضية
function createDefaultImageSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#8B5CF6;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#A855F7;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="300" height="200" fill="url(#grad)"/>
    <circle cx="150" cy="70" r="25" fill="rgba(255,255,255,0.3)"/>
    <polygon points="125,120 175,120 165,140 135,140" fill="rgba(255,255,255,0.3)"/>
    <text x="150" y="170" fill="white" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold">كلاشي</text>
  </svg>`;
}

// الحصول على استجابة عدم الاتصال
async function getOfflineResponse(request) {
  if (isNavigationRequest(request)) {
    // محاولة إرجاع الصفحة الرئيسية أو صفحة عدم الاتصال
    const offlineResponse = await caches.match('/Clashy/offline.html') || 
                           await caches.match('/Clashy/index.html') ||
                           await caches.match('/Clashy/');
    
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // إنشاء صفحة عدم اتصال بسيطة
    return new Response(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>كلاشي - غير متصل</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #F1F5F9; }
          .icon { font-size: 4rem; margin-bottom: 20px; }
          h1 { color: #8B5CF6; margin-bottom: 20px; }
          button { background: #8B5CF6; color: white; border: none; padding: 15px 30px; border-radius: 10px; cursor: pointer; font-size: 16px; }
          button:hover { background: #7C3AED; }
        </style>
      </head>
      <body>
        <div class="icon">📱</div>
        <h1>كلاشي</h1>
        <p>أنت غير متصل بالإنترنت حالياً</p>
        <p>التطبيق يعمل في وضع عدم الاتصال مع الميزات المحفوظة محلياً</p>
        <button onclick="window.location.reload()">🔄 إعادة المحاولة</button>
      </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  // للطلبات الأخرى
  return new Response('Offline', { 
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// فحص نوع الطلبات
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && 
          request.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => 
    url.pathname === asset || 
    url.pathname === asset.replace('/Clashy', '') ||
    asset.includes(url.pathname.split('/').pop())
  );
}

function isExternalAsset(request) {
  const url = new URL(request.url);
  return !url.hostname.includes('github.io') && 
         (url.hostname.includes('cdnjs.cloudflare.com') ||
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com') ||
          url.hostname.includes('cdn.jsdelivr.net') ||
          url.hostname.includes('via.placeholder.com'));
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('supabase.co') ||
         url.pathname.includes('/api/') ||
         url.pathname.includes('/rest/') ||
         url.pathname.includes('/auth/');
}

function isImageRequest(request) {
  return request.destination === 'image' ||
         request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|bmp)(\?.*)?$/i) ||
         request.url.includes('placeholder.com');
}

// معالجة الرسائل من التطبيق
self.addEventListener('message', event => {
  console.log('📨 SW: رسالة مستلمة:', event.data);
  
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ 
        version: '3.0.0',
        caches: [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME]
      });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      }).catch(error => {
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'CACHE_URLS':
      if (payload && Array.isArray(payload)) {
        cacheUrls(payload).then(() => {
          event.ports[0]?.postMessage({ success: true });
        }).catch(error => {
          event.ports[0]?.postMessage({ success: false, error: error.message });
        });
      }
      break;

    case 'FORCE_UPDATE':
      forceUpdateCache().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
  }
});

// مسح جميع التخزين المؤقت
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('clashy-'))
      .map(name => caches.delete(name))
  );
  console.log('🗑️ SW: تم مسح جميع التخزين المؤقت');
}

// تخزين URLs محددة
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const results = await Promise.allSettled(
    urls.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          return { url, success: true };
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.warn(`⚠️ SW: فشل تخزين URL ${url}:`, error);
        return { url, success: false, error: error.message };
      }
    })
  );
  
  console.log('💾 SW: تم تخزين URLs:', results);
  return results;
}

// فرض تحديث التخزين المؤقت
async function forceUpdateCache() {
  console.log('🔄 SW: فرض تحديث التخزين المؤقت...');
  
  // تحديث الموارد الأساسية
  const staticCache = await caches.open(STATIC_CACHE_NAME);
  await Promise.allSettled(
    STATIC_ASSETS.map(async url => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) {
          await staticCache.put(url, response);
        }
      } catch (error) {
        console.warn(`⚠️ SW: فشل تحديث ${url}:`, error);
      }
    })
  );
  
  console.log('✅ SW: تم تحديث التخزين المؤقت');
}

// تنظيف دوري للتخزين المؤقت
async function performPeriodicCleanup() {
  try {
    const dynamicCache = await caches.open(DYNAMIC_CACHE_NAME);
    const requests = await dynamicCache.keys();
    
    // احتفظ بآخر 100 عنصر فقط
    if (requests.length > 100) {
      const requestsToDelete = requests.slice(0, requests.length - 100);
      await Promise.all(
        requestsToDelete.map(request => dynamicCache.delete(request))
      );
      console.log(`🧹 SW: تم حذف ${requestsToDelete.length} عنصر قديم`);
    }
    
    // حذف العناصر القديمة (أكثر من أسبوع)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const allRequests = await dynamicCache.keys();
    
    for (const request of allRequests) {
      const response = await dynamicCache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (responseDate < oneWeekAgo) {
            await dynamicCache.delete(request);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ SW: خطأ في التنظيف الدوري:', error);
  }
}

// تشغيل التنظيف الدوري كل ساعة
setInterval(performPeriodicCleanup, 3600000);

// معالجة الإشعارات (للاستخدام المستقبلي)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const options = {
    body: event.data.text(),
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" fill="%238B5CF6" rx="32"/%3E%3Ctext x="96" y="120" fill="white" font-size="42" font-weight="bold" text-anchor="middle" font-family="Arial"%3Eكلاشي%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"%3E%3Ccircle cx="48" cy="48" r="48" fill="%238B5CF6"/%3E%3Ctext x="48" y="60" fill="white" font-size="20" font-weight="bold" text-anchor="middle"%3E🛒%3C/text%3E%3C/svg%3E',
    dir: 'rtl',
    lang: 'ar',
    tag: 'clashy-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'فتح كلاشي',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath fill="white" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/%3E%3C/svg%3E'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('كلاشي', options)
  );
});

// النقر على الإشعارات
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // البحث عن نافذة مفتوحة للتطبيق
        for (const client of clientList) {
          if (client.url.includes('/Clashy/') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // فتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow('/Clashy/');
        }
      })
    );
  }
});

// مراقبة اتصال الشبكة
self.addEventListener('online', () => {
  console.log('🌐 SW: عاد الاتصال بالإنترنت');
  // يمكن إضافة منطق مزامنة البيانات هنا
});

self.addEventListener('offline', () => {
  console.log('📱 SW: انقطع الاتصال بالإنترنت');
});

// مزامنة الخلفية (Background Sync)
self.addEventListener('sync', event => {
  console.log('🔄 SW: مزامنة خلفية:', event.tag);
  
  if (event.tag === 'clashy-background-sync') {
    event.waitUntil(
      performBackgroundSync()
    );
  }
});

// تنفيذ مزامنة الخلفية
async function performBackgroundSync() {
  try {
    console.log('🔄 SW: تنفيذ مزامنة خلفية...');
    
    // يمكن إضافة منطق مزامنة البيانات مع الخادم هنا
    // مثل رفع البيانات المحفوظة محلياً، تحديث المنتجات، إلخ
    
    // مثال: تحديث قائمة المنتجات
    await forceUpdateCache();
    
    console.log('✅ SW: تمت المزامنة الخلفية بنجاح');
    
  } catch (error) {
    console.error('❌ SW: خطأ في المزامنة الخلفية:', error);
    throw error; // إعادة الخطأ لإعادة المحاولة لاحقاً
  }
}

console.log('🚀 Service Worker كلاشي v3.0.0 جاهز للعمل!');
console.log('📱 محسن للتثبيت كـ PWA حقيقي');
console.log('⚡ استراتيجيات تخزين متقدمة');
console.log('🔧 معالجة أخطاء شاملة');
console.log('🧹 تنظيف تلقائي للذاكرة');
console.log('🌐 دعم العمل بدون إنترنت');
console.log('🔄 مزامنة خلفية');
console.log('🔔 دعم الإشعارات');
console.log('📞 للدعم: 07813798636');