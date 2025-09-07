/**
 * SampleUrls - サンプルURL機能
 * サンプルURLの表示と選択機能を担当
 */

const SampleUrls = {
    elements: {
        sampleList: null,
        actorUrlInput: null
    },
    
    /**
     * 初期化
     */
    init() {
        this.elements.sampleList = document.getElementById('sample-url-list');
        this.elements.actorUrlInput = document.getElementById('actor-url');
        
        if (!this.elements.sampleList) {
            console.warn('SampleUrls: sample-url-list要素が見つかりません');
            return;
        }
        
        this.renderSampleUrls();
        console.log('SampleUrls 初期化完了');
    },
    
    /**
     * サンプルURLリストをレンダリング
     */
    renderSampleUrls() {
        const sampleUrls = AppUtils.getConfig('sampleUrls', []);
        
        if (sampleUrls.length === 0) {
            this.elements.sampleList.innerHTML = '<p class="no-samples">サンプルURLが設定されていません。</p>';
            return;
        }
        
        let html = '';
        
        sampleUrls.forEach((sample, index) => {
            html += this.createSampleItem(sample, index);
        });
        
        this.elements.sampleList.innerHTML = html;
        
        // イベントリスナーを追加
        this.attachEventListeners();
    },
    
    /**
     * サンプルアイテムのHTML生成
     */
    createSampleItem(sample, index) {
        const escapedName = AppUtils.escapeHtml(sample.name || 'サンプル');
        const escapedDescription = AppUtils.escapeHtml(sample.description || '');
        const escapedUrl = AppUtils.escapeHtml(sample.url || '');
        
        return `
            <div class="sample-item" data-index="${index}">
                <div class="sample-info">
                    <div class="sample-name">${escapedName}</div>
                    <div class="sample-description">${escapedDescription}</div>
                    <div class="sample-url" style="font-size: 0.75rem; color: #999; margin-top: 0.25rem; word-break: break-all;">
                        ${escapedUrl}
                    </div>
                </div>
                <button 
                    type="button" 
                    class="sample-button" 
                    data-url="${escapedUrl}"
                    data-name="${escapedName}"
                    title="${escapedName}のURLを入力欄に設定"
                    aria-label="${escapedName}のURLを入力欄に設定"
                >
                    使用
                </button>
            </div>
        `;
    },
    
    /**
     * イベントリスナーの追加
     */
    attachEventListeners() {
        const sampleButtons = this.elements.sampleList.querySelectorAll('.sample-button');
        
        sampleButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.handleSampleSelection(button);
            });
        });
        
        // キーボード操作対応
        this.elements.sampleList.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                const button = event.target.closest('.sample-button');
                if (button) {
                    event.preventDefault();
                    this.handleSampleSelection(button);
                }
            }
        });
    },
    
    /**
     * サンプル選択時の処理
     */
    handleSampleSelection(button) {
        const url = button.getAttribute('data-url');
        const name = button.getAttribute('data-name');
        
        if (!url || !AppUtils.isValidUrl(url)) {
            console.error('無効なサンプルURL:', url);
            return;
        }
        
        // 入力欄にURLを設定
        if (this.elements.actorUrlInput) {
            this.elements.actorUrlInput.value = url;
            this.elements.actorUrlInput.focus();
            
            // 入力イベントを発火（バリデーション等のトリガー）
            const inputEvent = new Event('input', { bubbles: true });
            this.elements.actorUrlInput.dispatchEvent(inputEvent);
        }
        
        // ボタンに一時的な視覚フィードバック
        this.showSelectionFeedback(button, name);
        
        console.log('サンプルURL選択:', { name, url });
    },
    
    /**
     * 選択時の視覚フィードバック
     */
    showSelectionFeedback(button, name) {
        const originalText = button.textContent;
        const originalStyle = {
            background: button.style.background,
            color: button.style.color
        };
        
        // フィードバック表示
        button.textContent = '設定済み';
        button.style.background = '#28a745';
        button.style.color = 'white';
        button.disabled = true;
        
        // 元に戻す
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalStyle.background;
            button.style.color = originalStyle.color;
            button.disabled = false;
        }, 1000);
        
        // アクセシビリティ通知
        this.announceSelection(name);
    },
    
    /**
     * スクリーンリーダー用の選択通知
     */
    announceSelection(name) {
        let liveRegion = document.getElementById('sample-live-region');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'sample-live-region';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.style.position = 'absolute';
            liveRegion.style.left = '-10000px';
            liveRegion.style.width = '1px';
            liveRegion.style.height = '1px';
            liveRegion.style.overflow = 'hidden';
            document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = `${name}のURLを入力欄に設定しました`;
    },
    
    /**
     * カスタムサンプルURLの追加（将来の拡張用）
     */
    addCustomSample(sample) {
        if (!sample.url || !sample.name) {
            console.error('無効なサンプルデータ:', sample);
            return false;
        }
        
        if (!AppUtils.isValidUrl(sample.url)) {
            console.error('無効なURL:', sample.url);
            return false;
        }
        
        // 現在の設定に追加
        const currentSamples = AppUtils.getConfig('sampleUrls', []);
        const newSamples = [...currentSamples, sample];
        
        // ローカルストレージに保存（設定が許可されている場合）
        const saved = AppUtils.storage.set('customSampleUrls', newSamples);
        
        if (saved) {
            // 再レンダリング
            APP_CONFIG.sampleUrls = newSamples;
            this.renderSampleUrls();
            console.log('カスタムサンプル追加:', sample);
            return true;
        }
        
        return false;
    },
    
    /**
     * サンプルURLの削除（将来の拡張用）
     */
    removeSample(index) {
        const currentSamples = AppUtils.getConfig('sampleUrls', []);
        
        if (index < 0 || index >= currentSamples.length) {
            console.error('無効なインデックス:', index);
            return false;
        }
        
        const newSamples = currentSamples.filter((_, i) => i !== index);
        
        // ローカルストレージに保存
        const saved = AppUtils.storage.set('customSampleUrls', newSamples);
        
        if (saved) {
            APP_CONFIG.sampleUrls = newSamples;
            this.renderSampleUrls();
            console.log('サンプル削除:', index);
            return true;
        }
        
        return false;
    },
    
    /**
     * サンプルURLの検証
     */
    validateSamples() {
        const sampleUrls = AppUtils.getConfig('sampleUrls', []);
        const validSamples = [];
        const invalidSamples = [];
        
        sampleUrls.forEach((sample, index) => {
            if (sample.url && sample.name && AppUtils.isValidUrl(sample.url)) {
                validSamples.push(sample);
            } else {
                invalidSamples.push({ index, sample });
            }
        });
        
        if (invalidSamples.length > 0) {
            console.warn('無効なサンプルURL:', invalidSamples);
        }
        
        return {
            valid: validSamples,
            invalid: invalidSamples
        };
    }
};

// グローバルに公開
window.SampleUrls = SampleUrls;
