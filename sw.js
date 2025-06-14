// Service Worker لتطبيق كلاشي PWA
const CACHE_NAME = 'clashy-v2.1.0';
const OFFLINE_URL = './index.html';

// الموارد المطلوب تخزينها مؤقتاً
const CACHE_URLS = [
  './',
  './index.html',
  './alhajami.html',
  './Al Ghadeer Office.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@200;300;400;500;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images/Clashy.png'
];

// التثبيت - تخزين الموارد الأساسية
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: تثبيت كلاشي PWA...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Service Worker: تخزين الموارد الأساسية...');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker: تم تخزين جميع الموارد بنجاح');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker: خطأ في التثبيت:', error);
      })
  );
});

// التفعيل - مسح التخزين المؤقت القديم
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker: تفعيل كلاشي PWA...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: حذف التخزين المؤقت القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: تم التفعيل بنجاح');
      return self.clients.claim();
    })
  );
});

// اعتراض الطلبات - استراتيجية Cache First مع Network Fallback
self.addEventListener('fetch', event => {
  // تجاهل الطلبات غير HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // تجاهل طلبات POST وغيرها من الطلبات التي لا تحتاج تخزين مؤقت
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وُجد في التخزين المؤقت، أرجعه
        if (response) {
          console.log('📦 Service Worker: تم تحميل من التخزين المؤقت:', event.request.url);
          return response;
        }

        // إذا لم يوجد، حاول جلبه من الشبكة
        return fetch(event.request)
          .then(response => {
            // إذا كان الرد غير صحيح، لا تخزنه
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // نسخ الرد للتخزين
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 Service Worker: تم تخزين مورد جديد:', event.request.url);
              });

            return response;
          })
          .catch(error => {
            console.log('🌐 Service Worker: خطأ في الشبكة، محاولة تحميل من التخزين المؤقت...', error);
            
            // إذا كان طلب صفحة HTML، أرجع الصفحة الرئيسية
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
            
            // إذا كان طلب صورة، أرجع صورة افتراضية
            if (event.request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#8B5CF6"/><text x="100" y="75" fill="white" text-anchor="middle" font-family="Arial" font-size="14">كلاشي</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            throw error;
          });
      })
  );
});

// رسائل من التطبيق الرئيسي
self.addEventListener('message', event => {
  console.log('📨 Service Worker: رسالة مستلمة:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(event.data.payload))
    );
  }
});

// التعامل مع تحديثات الخلفية
self.addEventListener('backgroundsync', event => {
  console.log('🔄 Service Worker: مزامنة الخلفية:', event.tag);
  
  if (event.tag === 'clashy-sync') {
    event.waitUntil(
      // يمكن إضافة منطق مزامنة البيانات هنا
      console.log('🔄 تزامن بيانات كلاشي في الخلفية')
    );
  }
});

// دفع الإشعارات (يمكن تفعيلها لاحقاً)
self.addEventListener('push', event => {
  console.log('🔔 Service Worker: إشعار مستلم:', event.data?.text());
  
  const options = {
    body: event.data?.text() || 'لديك إشعار جديد من كلاشي',
    icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images/Clashy.png',
    badge: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images/Clashy.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'clashy-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق',
        icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images/Clashy.png'
      },
      {
        action: 'close',
        title: 'إغلاق',
        icon: 'https://wgvkbrmcgejscgsyapcs.supabase.co/storage/v1/object/public/images/Clashy.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('كلاشي - السوق الإلكتروني', options)
  );
});

// النقر على الإشعارات
self.addEventListener('notificationclick', event => {
  console.log('👆 Service Worker: تم النقر على الإشعار:', event.action);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('https://krarar.github.io/Clashy/')
    );
  }
});

// تحديث محتوى التخزين المؤقت
async function updateCache() {
  const cache = await caches.open(CACHE_NAME);
  const cachedUrls = await cache.keys();
  
  console.log('🔄 Service Worker: تحديث التخزين المؤقت...');
  
  for (const request of cachedUrls) {
    try {
      const response = await fetch(request);
      if (response.status === 200) {
        await cache.put(request, response);
        console.log('✅ Service Worker: تم تحديث:', request.url);
      }
    } catch (error) {
      console.warn('⚠️ Service Worker: فشل تحديث:', request.url, error);
    }
  }
}

// جدولة تحديث دوري (كل ساعة)
setInterval(() => {
  updateCache().catch(console.error);
}, 3600000);

console.log('🚀 Service Worker لكلاشي PWA جاهز للعمل!');
