/**
 * LoadingManager - ローディング状態管理
 * ローディング表示の制御とユーザーフィードバックを担当
 */

const LoadingManager = {
    elements: {
        loadingSection: null,
        fetchButton: null,
        buttonText: null,
        buttonLoading: null
    },
    
    isLoading: false,
    
    /**
     * 初期化
     */
    init() {
        this.elements.loadingSection = document.getElementById('loading-section');
        this.elements.fetchButton = document.getElementById('fetch-button');
        this.elements.buttonText = this.elements.fetchButton?.querySelector('.btn-text');
        this.elements.buttonLoading = this.elements.fetchButton?.querySelector('.btn-loading');
        
        if (!this.elements.loadingSection || !this.elements.fetchButton) {
            console.warn('LoadingManager: 必要な要素が見つかりません');
        }
        
        console.log('LoadingManager 初期化完了');
    },
    
    /**
     * ローディング開始
     */
    show(message = 'データを取得しています...') {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        // ローディングセクションを表示
        if (this.elements.loadingSection) {
            const loadingText = this.elements.loadingSection.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            AppUtils.toggleElement(this.elements.loadingSection, true);
        }
        
        // ボタンの状態変更
        this.updateButtonState(true);
        
        // 他のセクションを非表示
        this.hideOtherSections();
        
        console.log('ローディング開始:', message);
    },
    
    /**
     * ローディング終了
     */
    hide() {
        if (!this.isLoading) return;
        
        this.isLoading = false;
        
        // ローディングセクションを非表示
        if (this.elements.loadingSection) {
            AppUtils.toggleElement(this.elements.loadingSection, false);
        }
        
        // ボタンの状態復元
        this.updateButtonState(false);
        
        console.log('ローディング終了');
    },
    
    /**
     * ボタンの状態更新
     */
    updateButtonState(loading) {
        if (!this.elements.fetchButton) return;
        
        if (loading) {
            this.elements.fetchButton.disabled = true;
            this.elements.fetchButton.setAttribute('aria-busy', 'true');
            
            if (this.elements.buttonText) {
                this.elements.buttonText.style.display = 'none';
            }
            if (this.elements.buttonLoading) {
                this.elements.buttonLoading.style.display = 'inline';
            }
        } else {
            this.elements.fetchButton.disabled = false;
            this.elements.fetchButton.removeAttribute('aria-busy');
            
            if (this.elements.buttonText) {
                this.elements.buttonText.style.display = 'inline';
            }
            if (this.elements.buttonLoading) {
                this.elements.buttonLoading.style.display = 'none';
            }
        }
    },
    
    /**
     * 他のセクションを非表示
     */
    hideOtherSections() {
        const sectionsToHide = [
            'error-section',
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
     * ローディング状態の取得
     */
    getState() {
        return this.isLoading;
    },
    
    /**
     * プログレス表示（将来の拡張用）
     */
    setProgress(percent, message) {
        // 現在は未実装、将来的にプログレスバーを追加する場合に使用
        console.log(`Progress: ${percent}% - ${message}`);
    }
};

// グローバルに公開
window.LoadingManager = LoadingManager;
