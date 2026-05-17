# Yerel AI Sohbet Uygulaması

Bu proje, yerel makinenizde barındırdığınız GGUF (Llama.cpp destekli) dil modelleriyle etkileşime girmenizi sağlayan bir yapay zeka sohbet asistanıdır. Uygulama, FastAPI tabanlı bir backend ve Vanilla JavaScript ile yazılmış, modern ve şık bir frontend arayüzüne sahiptir.

## Özellikler

- **Yerel Model Çalıştırma**: Verileriniz dışarı çıkmadan (offline) yerel GGUF formatındaki modellerle sohbet edebilirsiniz.
- **Model Seçimi**: `models` klasörüne eklediğiniz farklı GGUF modelleri arasında arayüz üzerinden dinamik geçiş.
- **Sohbet Geçmişi**: Konuşmalarınız SQLite veritabanına kaydedilir, böylece önceki sohbetlerinize geri dönebilirsiniz.
- **Güvenlik**: Basit bir API Anahtarı (`API_KEY`) katmanı sayesinde yetkisiz erişimleri engeller.
- **Sesli Giriş**: Tarayıcınızın konuşma tanıma özelliği ile sesinizi metne dökerek modele prompt gönderebilirsiniz.

## Ön Gereksinimler

- **Python 3.8 veya üzeri**: Sisteminizde Python'un kurulu olduğundan emin olun.  
  (Kontrol etmek için terminalde `python --version` komutunu çalıştırabilirsiniz.)
- **C/C++ Derleyicisi** (İsteğe bağlı fakat önerilir): `llama-cpp-python` kütüphanesinin sorunsuz ve hızlı derlenebilmesi için sisteminizde gerekli derleme araçlarının (Windows için Build Tools, Linux için `build-essential`, macOS için Xcode) bulunması tavsiye edilir.

## Kurulum ve Çalıştırma

### 1. Depoyu Klonlayın

```bash
git clone https://github.com/KULLANICI_ADINIZ/PROJE_ADINIZ.git
cd PROJE_ADINIZ
```

### 2. Gerekli Kütüphaneleri Yükleyin

Proje dizininde aşağıdaki komutu çalıştırarak gerekli paketleri kurun:

```bash
pip install -r requirements.txt
```

> **Not:** `llama-cpp-python` yüklemesi cihazınızın performansına bağlı olarak derleme süreci gerektirebilir ve biraz vakit alabilir.

### 3. Ortam Değişkenlerini (API Key) Ayarlayın

Proje ana dizininde `.env` adında bir dosya oluşturun ve içerisine kendi API anahtarınızı belirleyin:

```env
API_KEY=benim_gizli_anahtarim_123
GGUF_MODEL_PATH=models
```

### 4. Modeli İndirin ve Yerleştirin

1. [Hugging Face Hub](https://huggingface.co/models) adresine gidin.
2. Türkçe veya dilediğiniz başka bir dildeki `.gguf` uzantılı bir modeli indirin (Örn: `mistral-7b-instruct-v0.2.Q4_K_M.gguf`).
3. İndirdiğiniz modeli proje dizinindeki `models` klasörünün içine atın. (Eğer `models` klasörü yoksa oluşturun).

### 5. Sunucuyu Başlatın

FastAPI sunucusunu başlatmak için aşağıdaki komutu çalıştırın:

```bash
uvicorn main:app --reload
```

Terminalde modelin yüklendiğine dair bilgiler ve "Application startup complete." mesajını gördüğünüzde sunucu hazır demektir (Varsayılan olarak `http://127.0.0.1:8000` adresinde çalışır).

### 6. Uygulamayı Kullanın

`frontend` klasörünün içindeki `index.html` dosyasına çift tıklayarak uygulamayı tarayıcınızda açın. İlk girişte sizden `.env` dosyasında belirlediğiniz API anahtarını isteyecektir.

## Klasör Yapısı

- `main.py`: FastAPI sunucu kodları, veritabanı şemaları ve API yönlendirmeleri.
- `requirements.txt`: Projenin çalışması için gereken Python kütüphaneleri.
- `frontend/`: HTML, CSS ve Vanilla JS dosyalarını içeren modern kullanıcı arayüzü.
- `models/`: GGUF formatındaki dil modellerinin yer alması gereken klasör (Git üzerinde izlenmez).
- `.env`: API anahtarınızın bulunduğu gizli dosya (Git üzerinde izlenmez).
- `.gitignore`: Git'e yüklenmemesi gereken geçici ve büyük boyutlu dosyaları belirten dosya.

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına göz atabilirsiniz.
