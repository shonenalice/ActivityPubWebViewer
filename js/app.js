/**
 * ActivityPub Web Viewer - Application Initialization
 * アプリケーションの初期化とグローバル設定管理
 */

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log(`${APP_CONFIG.app.name} v${APP_CONFIG.app.version} - 初期化開始`);
    
    try {
        // 各モジュールの初期化
        initializeModules();
        
        // JavaScript無効対応の警告を削除
        removeNoScriptWarnings();
        
        console.log('アプリケーション初期化完了');
        
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
        showInitializationError();
    }
});

/**
 * 各モジュールの初期化
 */
function initializeModules() {
    // 初期化順序が重要
    const initOrder = [
        { name: 'LoadingManager', init: () => LoadingManager.init() },
        { name: 'ErrorHandler', init: () => ErrorHandler.init() },
        { name: 'SampleUrls', init: () => SampleUrls.init() },
        { name: 'PostRenderer', init: () => PostRenderer.init() },
        { name: 'ApiClient', init: () => ApiClient.init() },
        { name: 'FormHandler', init: () => FormHandler.init() }
    ];
    
    initOrder.forEach(module => {
        try {
            if (typeof window[module.name] !== 'undefined') {
                module.init();
                console.log(`${module.name} 初期化完了`);
            } else {
                console.warn(`${module.name} が見つかりません`);
            }
        } catch (error) {
            console.error(`${module.name} 初期化エラー:`, error);
        }
    });
}

/**
 * NoScript警告の削除
 */
function removeNoScriptWarnings() {
    const noScriptElements = document.querySelectorAll('.no-script-warning');
    noScriptElements.forEach(element => element.remove());
}

/**
 * 初期化エラー時の表示
 */
function showInitializationError() {
    const errorHtml = `
        <div class="init-error" style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 9999;
            max-width: 300px;
        ">
            <h4>初期化エラー</h4>
            <p>アプリケーションの初期化に失敗しました。ページを再読み込みしてください。</p>
            <button onclick="location.reload()" style="
                background: white;
                color: #dc3545;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 0.5rem;
            ">再読み込み</button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHtml);
}

/**
 * ユーティリティ関数群
 */
const AppUtils = {
    /**
     * 設定値の取得
     */
    getConfig(key, defaultValue = null) {
        const keys = key.split('.');
        let value = APP_CONFIG;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    },
    
    /**
     * 安全なHTML文字列生成
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * 日時フォーマット
     */
    formatDate(dateString, timezone = 'Asia/Tokyo') {
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ja-JP', {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            console.warn('日時フォーマットエラー:', error);
            return dateString;
        }
    },
    
    /**
     * 相対時間の取得
     */
    getRelativeTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMinutes < 1) return 'たった今';
            if (diffMinutes < 60) return `${diffMinutes}分前`;
            if (diffHours < 24) return `${diffHours}時間前`;
            if (diffDays < 7) return `${diffDays}日前`;
            
            return this.formatDate(dateString);
        } catch (error) {
            console.warn('相対時間取得エラー:', error);
            return dateString;
        }
    },
    
    /**
     * URLバリデーション
     */
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    },
    
    /**
     * デバウンス関数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * 要素の表示/非表示切り替え
     */
    toggleElement(element, show) {
        if (!element) return;
        
        if (show) {
            element.style.display = '';
            element.removeAttribute('aria-hidden');
        } else {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
        }
    },
    
    /**
     * ローカルストレージの安全な使用
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.warn('ローカルストレージ保存エラー:', error);
                return false;
            }
        },
        
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('ローカルストレージ読み込みエラー:', error);
                return defaultValue;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('ローカルストレージ削除エラー:', error);
                return false;
            }
        }
    }
};

// グローバルオブジェクトとして利用可能にする
window.AppUtils = AppUtils;

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
    
    // 重要なエラーの場合はユーザーに通知
    if (event.error && event.error.name === 'TypeError') {
        console.warn('JavaScript実行エラーが発生しました');
    }
});

// 未処理のPromise rejection対応
window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise rejection:', event.reason);
    event.preventDefault(); // エラーをコンソールに表示させない
});
