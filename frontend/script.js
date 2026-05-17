document.addEventListener('DOMContentLoaded', () => {
    // --- Element Seçimleri ---
    const chatApp = document.getElementById('main-content');
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const modelSelect = document.getElementById('ai-model-select');
    const newChatButton = document.getElementById('new-chat-button');
    const conversationList = document.getElementById('conversation-list');
    const deleteConversationButton = document.getElementById('delete-conversation-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const voiceInputButton = document.getElementById('voice-input-button');

    // API Key Modal Elementleri
    const apiKeyModal = document.getElementById('api-key-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeySubmitButton = document.getElementById('api-key-submit');
    const apiKeyError = document.getElementById('api-key-error');

    // Custom Alert/Confirm Modal Elementleri
    const customAlertModal = document.getElementById('custom-alert-modal');
    const customAlertTitle = document.getElementById('custom-alert-title');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertCloseButton = document.getElementById('custom-alert-close-button');
    const customConfirmModal = document.getElementById('custom-confirm-modal');
    const customConfirmTitle = document.getElementById('custom-confirm-title');
    const customConfirmMessage = document.getElementById('custom-confirm-message');
    const customConfirmYesButton = document.getElementById('custom-confirm-yes-button');
    const customConfirmNoButton = document.getElementById('custom-confirm-no-button');

    // --- API Uç Noktaları ---
    const API_BASE_URL = 'http://127.0.0.1:8000';
    const MODELS_API_URL = `${API_BASE_URL}/models`;
    const CONVERSATIONS_API_URL = `${API_BASE_URL}/conversations`;

    // --- Durum Değişkenleri ---
    let messages = []; // Mevcut sohbetin mesaj geçmişi
    let currentConversationId = null; // Aktif sohbet ID'si
    let currentApiKey = null; // Kullanıcının girdiği API Anahtarı

    // --- Fonksiyonlar ---

    // API Anahtarı Modalını Yönetme
    const showApiKeyModal = () => {
        apiKeyModal.classList.remove('hidden');
        chatApp.style.display = 'none'; // Uygulama alanını gizle
    };

    const hideApiKeyModal = () => {
        apiKeyModal.classList.add('hidden');
        chatApp.style.display = 'flex'; // Uygulama alanını göster
        // API anahtarı girildikten sonra sohbetleri ve modelleri yükle
        fetchConversations();
        fetchModels();
    };

    apiKeySubmitButton.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            currentApiKey = key;
            apiKeyError.textContent = '';
            hideApiKeyModal();
        } else {
            apiKeyError.textContent = 'Lütfen bir API anahtarı girin.';
        }
    });

    // Özel Alert ve Confirm Modallarını Yönetme
    const showMessageBox = (title, message, isError = false) => {
        customAlertTitle.textContent = title;
        customAlertMessage.textContent = message;
        if (isError) {
            customAlertModal.classList.add('error');
        } else {
            customAlertModal.classList.remove('error');
        }
        customAlertModal.classList.remove('hidden');
    };

    const hideMessageBox = () => {
        customAlertModal.classList.add('hidden');
    };

    const showConfirmBox = (title, message, onConfirm) => {
        customConfirmTitle.textContent = title;
        customConfirmMessage.textContent = message;
        customConfirmModal.classList.remove('hidden');

        const handleConfirm = () => {
            onConfirm();
            customConfirmModal.classList.add('hidden');
            customConfirmYesButton.removeEventListener('click', handleConfirm);
            customConfirmNoButton.removeEventListener('click', handleCancel);
        };

        const handleCancel = () => {
            customConfirmModal.classList.add('hidden');
            customConfirmYesButton.removeEventListener('click', handleConfirm);
            customConfirmNoButton.removeEventListener('click', handleCancel);
        };

        customConfirmYesButton.addEventListener('click', handleConfirm);
        customConfirmNoButton.addEventListener('click', handleCancel);
    };

    customAlertCloseButton.addEventListener('click', hideMessageBox);

    // API isteği göndermek için yardımcı fonksiyon
    const callApi = async (url, method = 'GET', body = null) => {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-API-Key': currentApiKey
            };
            const options = {
                method,
                headers
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);

            if (response.ok) {
                return await response.json();
            } else {
                const errorData = await response.json();
                let errorMessage = errorData.detail || `API Hatası: ${response.status} - ${response.statusText}`;

                if (response.status === 405) {
                    errorMessage = `Sunucu Hatası: Method Not Allowed. '${url.split('/').pop()}' endpoint'i için ${method} metodu desteklenmiyor.`;
                } else if (response.status === 422) {
                    errorMessage = `Sunucu Hatası: Eksik veya hatalı veri. Lütfen girdilerinizi kontrol edin.`;
                }

                showMessageBox('API Hatası', errorMessage, true);
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('API isteği başarısız:', error);
            showMessageBox('API İletişim Hatası', `İstek gönderilemedi: ${error.message}. Sunucunuzun çalıştığından ve modelin yüklendiğinden emin olun.`, true);
            return null;
        }
    };

    // Mevcut modelleri API'den çekme
    const fetchModels = async () => {
        const models = await callApi(MODELS_API_URL);
        modelSelect.innerHTML = '';
        if (models && models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            // İlk modeli varsayılan olarak seç
            modelSelect.value = models[0];
        } else {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Model bulunamadı";
            modelSelect.appendChild(option);
            showMessageBox('Model Hatası', 'Models klasöründe GGUF modeli bulunamadı.', true);
        }
    };

    // Sohbet geçmişini API'den çekme
    const fetchConversations = async () => {
        const conversations = await callApi(CONVERSATIONS_API_URL);
        if (conversations) {
            conversationList.innerHTML = '';
            conversations.forEach(conv => {
                const li = document.createElement('li');
                li.className = 'conversation-item';
                li.setAttribute('data-id', conv.id);
                li.innerHTML = `<span class="title">${conv.title || 'Yeni Sohbet'}</span>`;
                li.addEventListener('click', () => {
                    loadConversation(conv.id, conv.title);
                });
                conversationList.appendChild(li);
            });
            // Eğer varsa ilk sohbeti otomatik yükle
            if (conversations.length > 0 && !currentConversationId) {
                loadConversation(conversations[0].id, conversations[0].title);
            }
        }
    };

    // Belirli bir sohbeti yükleme
    const loadConversation = async (convId, convTitle) => {
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`.conversation-item[data-id="${convId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        currentConversationId = convId;
        document.getElementById('current-conversation-title').textContent = convTitle || 'Yeni Sohbet';
        deleteConversationButton.style.display = 'block';

        const conversationMessages = await callApi(`${CONVERSATIONS_API_URL}/${convId}/messages`);
        if (conversationMessages) {
            messages = conversationMessages;
            renderMessages();
        }
    };

    // Yeni bir sohbet başlatma
    const startNewChat = () => {
        currentConversationId = null;
        messages = [];
        renderMessages();
        document.getElementById('current-conversation-title').textContent = 'Yeni Sohbet';
        deleteConversationButton.style.display = 'none';
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        userInput.focus();
    };

    // Sohbeti silme
    const deleteCurrentConversation = () => {
        if (!currentConversationId) return;

        showConfirmBox("Sohbeti Sil", "Bu sohbeti silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.", async () => {
            const result = await callApi(`${CONVERSATIONS_API_URL}/${currentConversationId}`, 'DELETE');
            if (result) {
                showMessageBox('Başarılı', result.message);
                startNewChat();
                fetchConversations();
            }
        });
    };


    // Mesajları ekrana basma
    const renderMessages = () => {
        chatBox.innerHTML = '';
        if (messages.length === 0) {
            chatBox.innerHTML = '<div class="chat-initial-message"><p>Merhaba! Başlamak için bir mesaj yazın veya yeni bir sohbet başlatın.</p></div>';
        } else {
            messages.forEach(msg => {
                displayMessage(msg.role, msg.content);
            });
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    // Mesaj baloncuğu oluşturma
    const displayMessage = (role, content) => {
        const messageElement = document.createElement('div');
        messageElement.className = `message-bubble ${role}`;
        messageElement.innerHTML = `<p>${content}</p>`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    // Kullanıcının mesajını gönderme
    const sendMessage = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        displayMessage('user', text);
        messages.push({ role: 'user', content: text });
        userInput.value = '';
        loadingIndicator.style.display = 'flex';
        sendButton.disabled = true;

        const selectedModel = modelSelect.value;
        if (!selectedModel) {
            showMessageBox('Hata', 'Lütfen bir model seçin.', true);
            loadingIndicator.style.display = 'none';
            sendButton.disabled = false;
            return;
        }

        const payload = {
            model: selectedModel,
            message: text,
            conversation_id: currentConversationId
        };
        
        const result = await callApi(`${API_BASE_URL}/chat`, 'POST', payload);

        loadingIndicator.style.display = 'none';
        sendButton.disabled = false;

        if (result && result.response) {
            displayMessage('bot', result.response);
            messages.push({ role: 'bot', content: result.response });
            if (result.conversation_id && !currentConversationId) {
                currentConversationId = result.conversation_id;
                fetchConversations();
            }
        }
    };

    // --- Sesli Giriş Fonksiyonu ---
    let recognition;
    let isRecognizing = false;

    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'tr-TR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isRecognizing = true;
            voiceInputButton.textContent = 'Dinliyor...';
            voiceInputButton.disabled = true;
            userInput.placeholder = 'Dinliyorum...';
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            isRecognizing = false;
            voiceInputButton.textContent = 'Sesli Giriş';
            voiceInputButton.disabled = false;
            userInput.placeholder = 'Mesajınızı buraya yazın...';
            sendMessage();
        };
        recognition.onerror = (event) => {
            console.error('Sesli giriş hatası:', event.error);
            isRecognizing = false;
            voiceInputButton.textContent = 'Sesli Giriş';
            voiceInputButton.disabled = false;
            userInput.placeholder = 'Mesajınızı buraya yazın...';
        };
        recognition.onend = () => {
            isRecognizing = false;
            voiceInputButton.textContent = 'Sesli Giriş';
            voiceInputButton.disabled = false;
            userInput.placeholder = 'Mesajınızı buraya yazın...';
        };
        voiceInputButton.addEventListener('click', () => {
            if (!isRecognizing) recognition.start();
        });
    } else {
        voiceInputButton.disabled = true;
        voiceInputButton.textContent = 'Sesli Giriş Desteklenmiyor';
        console.warn('Web Speech API tarayıcınız tarafından desteklenmiyor.');
    }

    // --- Olay Dinleyicileri ---
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    newChatButton.addEventListener('click', startNewChat);
    deleteConversationButton.addEventListener('click', deleteCurrentConversation);

    // --- Uygulama Başlangıcı ---
    showApiKeyModal();
});
