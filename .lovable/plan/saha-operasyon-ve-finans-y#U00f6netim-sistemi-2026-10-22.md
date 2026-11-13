# Saha Operasyon ve Finans Yönetim Sistemi

Doküman çok büyük (6 modül, ~50 özellik). Hatasız teslim için tek seferde değil, her aşaması çalışır ve test edilmiş halde 4 aşamada inşa edilecek. Bu onayla **Aşama 1** yapılır; sonraki aşamalar sırayla devam eder.

## Tasarım
- AMOLED siyah zemin (saf siyah), tek vurgu rengi: sakin turkuaz/yeşil; kırmızı yalnızca uyarılar için.
- Mobil öncelikli: alt menü (Panel, İşler, Cari, Yevmiye, Ekipman), sağ altta Hızlı Ekle butonu, üstte global arama.
- Kaydırarak silme, 5 sn "Geri Al" bildirimi, titreşim geri bildirimi (destekleyen cihazlarda).
- Tamamen Türkçe arayüz, TL para biçimi.

## Aşama 1 — Çekirdek + Finans (bu adım)
- Lovable Cloud açılır.
- Giriş/Kayıt: sadece kullanıcı adı + şifre, e-posta yok, doğrulama yok (arka planda kullanıcı adından sahte adres türetilir; şifre sıfırlama e-postası bu yüzden çalışmaz).
- Roller: Usta / Çırak (ayrı rol tablosu, güvenlik kuralları). Kayıt olan ilk kişi kendi ekibinin Ustası; Usta, çırak hesabı ekleyebilir.
- Müşteriler: iletişim, adres, gizli 1-5 yıldız puan.
- Cari hesap: borç / parçalı tahsilat, tarih damgalı ekstre, kalan bakiye, 30 günü geçen borçlara kırmızı rozet.
- Giderler: Yakıt, Yemek, Hırdavat, Vergi, Diğer.
- Panel: aylık gelir, gider, bekleyen alacak, net kâr; pasta ve çubuk grafik.
- Kâr/KDV hesabı (%10, %20) iş bazında.
- PDF makbuz oluşturma ve cihazın paylaş menüsüyle paylaşma.
- Mesaj şablonları (ayarlarda düzenlenebilir), değişkenler otomatik dolup WhatsApp/SMS açılır.
- Ana ekrana ekle desteği (uygulama simgesi, tam ekran).

## Aşama 2 — İşler ve Operasyon
- İş statüleri, şablonlar, saatlik kronometre (başlat/duraklat, dakika hesabı, cariye otomatik borç).
- Öncesi/sonrası fotoğraf, sesli not, parmakla dijital imza.
- Google Haritalar / Yandex tek tık, günlük rota listesi, hava durumu (anahtarsız Open-Meteo).

## Aşama 3 — Yevmiye ve Bordro
- Şantiye bazlı takvim, 1 / 0.5 / 0.25 gün, x1.5 / x2 çarpan.
- Aylık hakediş otomatik hesap, avans düşümü. Çırak yalnızca kendi kaydını görür.

## Aşama 4 — Ekipman + Ekstralar
- Ekipman sicili, çalışma sayacı ve bakım uyarısı, bakım maliyet logu, amortisman.
- Emanet takibi, alınacaklar listesi, QR/barkod okuma.
- Başarı rozetleri, PIN kilidi ve parmak izi/FaceID hızlı giriş.
- Çevrimdışı mod: bağlantı yokken kayıtlar cihazda kuyruğa alınır, bağlantı gelince gönderilir (yalnızca yayınlanmış uygulamada çalışır, önizlemede değil).

## Teknik notlar
- TanStack Start + Cloud (veritabanı, auth, dosya depolama). Her tabloda GRANT + RLS; veri ekip (team_id) bazlı, çırak satırları kendi user_id'si ile sınırlı; roller `user_roles` + `has_role`.
- Kullanıcı adı girişi: `${username}@saha.local`, otomatik onay açık, `profiles` tablosunda benzersiz kullanıcı adı.
- Recharts, jsPDF, Web Share API; offline için vite-plugin-pwa + önizlemede kapalı kayıt kuralı ve IndexedDB/LocalStorage gönderim kuyruğu.
- Hesap kuralları (cari bakiye, KDV/net kâr, vade 30 gün, yevmiye çarpanları, avans düşümü) için birim testler yazılır.
