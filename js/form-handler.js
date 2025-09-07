/**
 * FormHandler - フォーム処理
 * フォーム入力の検証と送信処理を担当
 */

const FormHandler = {
    elements: {
        form: null,
        actorUrlInput: null,
        fetchButton: null
    },
    
    isProcessing: false,
    lastSubmittedUrl: null,
    
    /**
     * 初期化
     */
    init() {
        this.elements.form = document.getElementById('fetch-form');
        this.elements.actorUrlInput = document.getElementById('actor-url');
        this.elements.fetchButton = document.getElementById('fetch-button');
        
        if (!this.elements.form || !this.elements.actorUrlInput) {
            console.warn('FormHandler: 必要な要素が見つかりません');
            return;
        }
        
        this.attachEventListeners();
        this.setupValidation();
        
        console.log('FormHandler 初期化完了');
    },
    
    /**
     * イベントリスナーの設定
     */
    attachEventListeners() {
        // フォーム送信イベント
        this.elements.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.handleSubmit();
        });
        
        // 入力値の変更イベント
        this.elements.actorUrlInput.addEventListener('input', 
            AppUtils.debounce(() => this.handleInputChange(), 300)
        );
        
        // フォーカスイベント
        this.elements.actorUrlInput.addEventListener('focus', () => {
            this.clearValidationState();
        });
        
        // ペーストイベント
        this.elements.actorUrlInput.addEventListener('paste', (event) => {
            setTimeout(() => this.handleInputChange(), 100);
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            // Ctrl+Enter または Cmd+Enter で送信
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                if (!this.isProcessing) {
                    this.handleSubmit();
                }
            }
        });
    },
    
    /**
     * バリデーション設定
     */
    setupValidation() {
        // HTML5バリデーション属性の設定
        this.elements.actorUrlInput.setAttribute('pattern', 'https://.*');
        this.elements.actorUrlInput.setAttribute('title', 'HTTPSのURLを入力してください');
    },
    
    /**
     * フォーム送信処理
     */
    async handleSubmit() {
        if (this.isProcessing) {
            console.log('処理中のため送信をスキップ');
            return;
        }
        
        const actorUrl = this.getActorUrl();
        
        // バリデーション
        const validationResult = this.validateInput(actorUrl);
        if (!validationResult.isValid) {
            this.showValidationError(validationResult.message);
            return;
        }
        
        // 重複送信チェック
        if (actorUrl === this.lastSubmittedUrl) {
            console.log('同じURLのため送信をスキップ');
            return;
        }
        
        this.isProcessing = true;
        this.lastSubmittedUrl = actorUrl;
        
        try {
            // ローディング開始
            LoadingManager.show('投稿データを取得しています...');
            
            // API呼び出し
            const data = await ApiClient.fetchPosts(actorUrl, AppUtils.getConfig('display.maxPosts', 20));
            
            // 結果表示
            PostRenderer.render(data);
            
            // 成功時の処理
            this.onSubmitSuccess(actorUrl, data);
            
        } catch (error) {
            console.error('送信エラー:', error);
            
            // エラー表示
            ErrorHandler.show(error, () => this.handleRetry(actorUrl));
            
            // 失敗時の処理
            this.onSubmitError(actorUrl, error);
            
        } finally {
            // ローディング終了
            LoadingManager.hide();
            this.isProcessing = false;
        }
    },
    
    /**
     * 入力値変更処理
     */
    handleInputChange() {
        const actorUrl = this.getActorUrl();
        
        if (!actorUrl) {
            this.clearValidationState();
            return;
        }
        
        const validationResult = this.validateInput(actorUrl);
        this.updateValidationState(validationResult);
    },
    
    /**
     * 再試行処理
     */
    handleRetry(url = null) {
        const actorUrl = url || this.getActorUrl();
        
        if (actorUrl) {
            // 前回の送信URLをクリアして再試行
            this.lastSubmittedUrl = null;
            this.handleSubmit();
        }
    },
    
    /**
     * Actor URLの取得
     */
    getActorUrl() {
        return this.elements.actorUrlInput.value.trim();
    },
    
    /**
     * 入力値のバリデーション
     */
    validateInput(actorUrl) {
        // 空の場合
        if (!actorUrl) {
            return {
                isValid: false,
                message: 'URLを入力してください。'
            };
        }
        
        // URL形式チェック
        if (!AppUtils.isValidUrl(actorUrl)) {
            return {
                isValid: false,
                message: 'HTTPSで始まる有効なURLを入力してください。'
            };
        }
        
        // 長さチェック
        if (actorUrl.length > 500) {
            return {
                isValid: false,
                message: 'URLが長すぎます。'
            };
        }
        
        // ActivityPub URLっぽいかチェック（簡易）
        if (!this.looksLikeActivityPubUrl(actorUrl)) {
            return {
                isValid: true, // 警告として扱う
                message: 'ActivityPubユーザーのURLでない可能性があります。',
                isWarning: true
            };
        }
        
        return {
            isValid: true,
            message: ''
        };
    },
    
    /**
     * ActivityPub URLらしさの簡易チェック
     */
    looksLikeActivityPubUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            // 一般的なパターンをチェック
            const patterns = [
                '/users/',
                '/u/',
                '/@',
                '/profile/',
                '/actor/'
            ];
            
            return patterns.some(pattern => pathname.includes(pattern));
        } catch {
            return false;
        }
    },
    
    /**
     * バリデーション状態の更新
     */
    updateValidationState(validationResult) {
        const input = this.elements.actorUrlInput;
        
        // CSSクラスの更新
        input.classList.remove('valid', 'invalid', 'warning');
        
        if (validationResult.isValid) {
            if (validationResult.isWarning) {
                input.classList.add('warning');
            } else {
                input.classList.add('valid');
            }
        } else {
            input.classList.add('invalid');
        }
        
        // カスタムバリデーションメッセージ
        input.setCustomValidity(validationResult.isValid ? '' : validationResult.message);
    },
    
    /**
     * バリデーション状態のクリア
     */
    clearValidationState() {
        const input = this.elements.actorUrlInput;
        input.classList.remove('valid', 'invalid', 'warning');
        input.setCustomValidity('');
    },
    
    /**
     * バリデーションエラーの表示
     */
    showValidationError(message) {
        // 入力フィールドにフォーカス
        this.elements.actorUrlInput.focus();
        
        // カスタムツールチップまたはブラウザデフォルト
        this.elements.actorUrlInput.setCustomValidity(message);
        this.elements.actorUrlInput.reportValidity();
        
        console.warn('バリデーションエラー:', message);
    },
    
    /**
     * 送信成功時の処理
     */
    onSubmitSuccess(actorUrl, data) {
        console.log('送信成功:', {
            url: actorUrl,
            posts: data.posts?.length || 0,
            actor: data.actor_info?.name || 'Unknown'
        });
        
        // 履歴保存（必要に応じて）
        this.saveToHistory(actorUrl, data.actor_info);
        
        // バリデーション状態をクリア
        this.clearValidationState();
    },
    
    /**
     * 送信失敗時の処理
     */
    onSubmitError(actorUrl, error) {
        console.error('送信失敗:', {
            url: actorUrl,
            error: error
        });
        
        // 失敗したURLをクリア（再試行可能にする）
        this.lastSubmittedUrl = null;
    },
    
    /**
     * 履歴への保存
     */
    saveToHistory(actorUrl, actorInfo) {
        try {
            const history = AppUtils.storage.get('urlHistory', []);
            
            // 重複チェック
            const existingIndex = history.findIndex(item => item.url === actorUrl);
            if (existingIndex !== -1) {
                // 既存の場合は削除（最新を先頭に追加するため）
                history.splice(existingIndex, 1);
            }
            
            // 新しいエントリを先頭に追加
            history.unshift({
                url: actorUrl,
                name: actorInfo?.name || 'Unknown',
                timestamp: new Date().toISOString()
            });
            
            // 履歴の数を制限（最大10件）
            if (history.length > 10) {
                history.splice(10);
            }
            
            AppUtils.storage.set('urlHistory', history);
            
        } catch (error) {
            console.warn('履歴保存エラー:', error);
        }
    },
    
    /**
     * 履歴の取得
     */
    getHistory() {
        return AppUtils.storage.get('urlHistory', []);
    },
    
    /**
     * URLの設定（外部から呼ばれる）
     */
    setActorUrl(url) {
        if (this.elements.actorUrlInput) {
            this.elements.actorUrlInput.value = url;
            this.handleInputChange();
        }
    },
    
    /**
     * フォームの有効/無効切り替え
     */
    setEnabled(enabled) {
        if (this.elements.actorUrlInput) {
            this.elements.actorUrlInput.disabled = !enabled;
        }
        
        if (this.elements.fetchButton) {
            this.elements.fetchButton.disabled = !enabled;
        }
    },
    
    /**
     * フォーカスの設定
     */
    focus() {
        if (this.elements.actorUrlInput) {
            this.elements.actorUrlInput.focus();
        }
    },
    
    /**
     * フォームのリセット
     */
    reset() {
        if (this.elements.form) {
            this.elements.form.reset();
        }
        
        this.clearValidationState();
        this.lastSubmittedUrl = null;
        this.isProcessing = false;
    }
};

// グローバルに公開
window.FormHandler = FormHandler;
