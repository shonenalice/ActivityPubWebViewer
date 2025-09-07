/**
 * ErrorHandler - エラーハンドリング
 * エラーメッセージの表示と管理を担当
 */

const ErrorHandler = {
    elements: {
        errorSection: null,
        errorMessage: null,
        retryButton: null
    },
    
    lastError: null,
    retryCallback: null,
    
    /**
     * 初期化
     */
    init() {
        this.elements.errorSection = document.getElementById('error-section');
        this.elements.errorMessage = document.getElementById('error-message');
        this.elements.retryButton = document.getElementById('retry-button');
        
        if (this.elements.retryButton) {
            this.elements.retryButton.addEventListener('click', () => this.handleRetry());
        }
        
        if (!this.elements.errorSection || !this.elements.errorMessage) {
            console.warn('ErrorHandler: 必要な要素が見つかりません');
        }
        
        console.log('ErrorHandler 初期化完了');
    },
    
    /**
     * エラー表示
     */
    show(error, retryCallback = null) {
        this.lastError = error;
        this.retryCallback = retryCallback;
        
        // エラーメッセージの設定
        const message = this.formatErrorMessage(error);
        if (this.elements.errorMessage) {
            this.elements.errorMessage.innerHTML = message;
        }
        
        // 再試行ボタンの表示制御
        if (this.elements.retryButton) {
            AppUtils.toggleElement(this.elements.retryButton, !!retryCallback);
        }
        
        // エラーセクションを表示
        if (this.elements.errorSection) {
            AppUtils.toggleElement(this.elements.errorSection, true);
        }
        
        // 他のセクションを非表示
        this.hideOtherSections();
        
        // アクセシビリティ対応
        this.announceError(message);
        
        console.error('エラー表示:', error);
    },
    
    /**
     * エラー非表示
     */
    hide() {
        if (this.elements.errorSection) {
            AppUtils.toggleElement(this.elements.errorSection, false);
        }
        
        this.lastError = null;
        this.retryCallback = null;
        
        console.log('エラー非表示');
    },
    
    /**
     * エラーメッセージのフォーマット
     */
    formatErrorMessage(error) {
        let message = '';
        let details = '';
        
        if (typeof error === 'string') {
            message = error;
        } else if (error && typeof error === 'object') {
            // API エラーレスポンスの場合
            if (error.error && error.error.user_message) {
                message = AppUtils.escapeHtml(error.error.user_message);
                if (error.error.code) {
                    details = `エラーコード: ${error.error.code}`;
                }
            }
            // JavaScript Error オブジェクトの場合
            else if (error.message) {
                message = this.getErrorMessageFromCode(error.message);
                details = `詳細: ${AppUtils.escapeHtml(error.message)}`;
            }
            // fetch エラーの場合
            else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                message = 'ネットワーク接続に失敗しました。インターネット接続を確認してください。';
            }
            else {
                message = '予期しないエラーが発生しました。';
                details = error.toString ? error.toString() : '不明なエラー';
            }
        } else {
            message = '予期しないエラーが発生しました。';
        }
        
        let html = `<p class="error-main-message">${message}</p>`;
        
        if (details) {
            html += `<p class="error-details" style="font-size: 0.875rem; color: #888; margin-top: 0.5rem;">${AppUtils.escapeHtml(details)}</p>`;
        }
        
        // 解決策の提案
        const suggestions = this.getErrorSuggestions(error);
        if (suggestions.length > 0) {
            html += '<div class="error-suggestions" style="margin-top: 1rem; text-align: left;">';
            html += '<strong>解決方法:</strong>';
            html += '<ul style="margin-top: 0.5rem; padding-left: 1.5rem;">';
            suggestions.forEach(suggestion => {
                html += `<li style="margin-bottom: 0.25rem;">${AppUtils.escapeHtml(suggestion)}</li>`;
            });
            html += '</ul></div>';
        }
        
        return html;
    },
    
    /**
     * エラーコードからユーザーフレンドリーなメッセージを取得
     */
    getErrorMessageFromCode(errorMessage) {
        const errorMappings = {
            'INVALID_URL': 'URLの形式が正しくありません。HTTPSのURLを入力してください。',
            'NETWORK_ERROR': 'ネットワーク接続に失敗しました。しばらく時間をおいてから再試行してください。',
            'HTTP_ERROR': 'データの取得に失敗しました。URLが正しいか確認してください。',
            'TIMEOUT_ERROR': '応答時間が長すぎます。しばらく時間をおいてから再試行してください。',
            'JSON_ERROR': 'データの解析に失敗しました。',
            'INVALID_ACTOR': '有効なActivityPubユーザーではありません。',
            'NO_OUTBOX': '投稿データが見つかりません。',
            'fetch': 'ネットワーク接続に失敗しました。'
        };
        
        for (const [key, message] of Object.entries(errorMappings)) {
            if (errorMessage.includes(key)) {
                return message;
            }
        }
        
        return '予期しないエラーが発生しました。';
    },
    
    /**
     * エラーに応じた解決策の提案
     */
    getErrorSuggestions(error) {
        const suggestions = [];
        
        if (typeof error === 'object' && error.error) {
            const errorCode = error.error.code;
            
            switch (errorCode) {
                case 'INVALID_URL':
                    suggestions.push('URLが https:// で始まっていることを確認してください');
                    suggestions.push('例: https://mastodon.social/users/ユーザー名');
                    break;
                case 'NETWORK_ERROR':
                case 'TIMEOUT_ERROR':
                    suggestions.push('インターネット接続を確認してください');
                    suggestions.push('しばらく時間をおいてから再試行してください');
                    break;
                case 'HTTP_ERROR':
                    suggestions.push('URLが正しいか確認してください');
                    suggestions.push('ユーザーが存在するか確認してください');
                    break;
                case 'INVALID_ACTOR':
                    suggestions.push('ActivityPub対応のSNS（Mastodon、Misskeyなど）のユーザーURLを入力してください');
                    suggestions.push('サンプルURLを参考にしてください');
                    break;
                case 'NO_OUTBOX':
                    suggestions.push('ユーザーが投稿を公開していない可能性があります');
                    suggestions.push('別のユーザーで試してみてください');
                    break;
            }
        } else if (typeof error === 'string' || (error && error.message)) {
            const errorMessage = typeof error === 'string' ? error : error.message;
            
            if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
                suggestions.push('インターネット接続を確認してください');
                suggestions.push('ページを再読み込みしてみてください');
            }
        }
        
        // 共通の提案
        if (suggestions.length === 0) {
            suggestions.push('ページを再読み込みしてみてください');
            suggestions.push('別のURLで試してみてください');
        }
        
        return suggestions;
    },
    
    /**
     * 再試行ハンドラー
     */
    handleRetry() {
        if (this.retryCallback && typeof this.retryCallback === 'function') {
            this.hide();
            this.retryCallback();
        }
    },
    
    /**
     * 他のセクションを非表示
     */
    hideOtherSections() {
        const sectionsToHide = [
            'loading-section',
            'results-section'
        ];
        
        sectionsToHide.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                AppUtils.toggleElement(section, false);
            }
        });
    },
    
    /**
     * スクリーンリーダー用のエラー通知
     */
    announceError(message) {
        // ARIA live region を使用してエラーを通知
        let liveRegion = document.getElementById('error-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'error-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-10000px';
            liveRegion.style.width = '1px';
            liveRegion.style.height = '1px';
            liveRegion.style.overflow = 'hidden';
            document.body.appendChild(liveRegion);
        }
        
        // テキストのみを抽出してスクリーンリーダーに通知
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = message;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        liveRegion.textContent = `エラーが発生しました: ${textContent}`;
    }
};

// グローバルに公開
window.ErrorHandler = ErrorHandler;
