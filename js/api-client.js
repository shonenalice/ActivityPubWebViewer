/**
 * ApiClient - API通信
 * バックエンドAPIとの通信を担当
 */

const ApiClient = {
    config: {
        apiUrl: './api.php',
        timeout: 10000, // 10秒
        retryAttempts: 2,
        retryDelay: 1000 // 1秒
    },
    
    /**
     * 初期化
     */
    init() {
        // 設定の上書き
        this.config.timeout = (AppUtils.getConfig('app.timeout', 10) * 1000);
        
        console.log('ApiClient 初期化完了');
    },
    
    /**
     * 投稿データの取得
     */
    async fetchPosts(actorUrl, maxPosts = 20) {
        const requestData = {
            action: 'fetch_posts',
            actor_url: actorUrl,
            max_posts: maxPosts
        };
        
        // リクエストの前処理
        const processedData = this.preprocessRequest(requestData);
        
        // APIリクエスト実行
        const responseData = await this.makeRequest(processedData);
        
        // レスポンスの後処理
        return this.postprocessResponse(responseData);
    },
    
    /**
     * APIリクエストの実行
     */
    async makeRequest(data, retryCount = 0) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            
            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }
            
            const responseData = await response.json();
            
            if (!responseData.success) {
                throw responseData;
            }
            
            return responseData.data;
            
        } catch (error) {
            // タイムアウトエラーの場合
            if (error.name === 'AbortError') {
                const timeoutError = {
                    error: {
                        code: 'TIMEOUT_ERROR',
                        message: 'Request timeout',
                        user_message: '応答時間が長すぎます。しばらく時間をおいてから再試行してください。'
                    }
                };
                
                // リトライ処理
                if (retryCount < this.config.retryAttempts) {
                    console.log(`タイムアウト - リトライ ${retryCount + 1}/${this.config.retryAttempts}`);
                    await this.delay(this.config.retryDelay * (retryCount + 1));
                    return this.makeRequest(data, retryCount + 1);
                }
                
                throw timeoutError;
            }
            
            // ネットワークエラーの場合
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                const networkError = {
                    error: {
                        code: 'NETWORK_ERROR',
                        message: 'Network connection failed',
                        user_message: 'ネットワーク接続に失敗しました。インターネット接続を確認してください。'
                    }
                };
                
                // リトライ処理
                if (retryCount < this.config.retryAttempts) {
                    console.log(`ネットワークエラー - リトライ ${retryCount + 1}/${this.config.retryAttempts}`);
                    await this.delay(this.config.retryDelay * (retryCount + 1));
                    return this.makeRequest(data, retryCount + 1);
                }
                
                throw networkError;
            }
            
            // その他のエラー
            throw error;
        }
    },
    
    /**
     * 遅延処理（リトライ用）
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * リクエストの前処理
     */
    preprocessRequest(data) {
        // URL の正規化
        if (data.actor_url) {
            data.actor_url = data.actor_url.trim();
            
            // HTTPSでない場合は警告
            if (!data.actor_url.startsWith('https://')) {
                console.warn('HTTP URLが指定されました。HTTPSが推奨されます。');
            }
        }
        
        // 最大投稿数の制限
        if (data.max_posts) {
            data.max_posts = Math.min(Math.max(parseInt(data.max_posts) || 20, 1), 50);
        }
        
        return data;
    },
    
    /**
     * レスポンスの後処理
     */
    postprocessResponse(data) {
        // 投稿データの検証と正規化
        if (data.posts && Array.isArray(data.posts)) {
            data.posts = data.posts.map(post => this.normalizePost(post));
        }
        
        // メタ情報の追加
        if (data.meta) {
            data.meta.processed_at = new Date().toISOString();
        }
        
        return data;
    },
    
    /**
     * 投稿データの正規化
     */
    normalizePost(post) {
        // 必須フィールドの確認
        const normalizedPost = {
            id: post.id || '',
            content: post.content || '',
            published_at: post.published_at || new Date().toISOString(),
            formatted_date: post.formatted_date || '',
            url: post.url || null,
            attachments: Array.isArray(post.attachments) ? post.attachments : [],
            author: post.author || {}
        };
        
        // 添付ファイルの正規化
        normalizedPost.attachments = normalizedPost.attachments.map(attachment => ({
            type: attachment.type || 'unknown',
            url: attachment.url || '',
            alt_text: attachment.alt_text || ''
        }));
        
        // 投稿者情報の正規化
        normalizedPost.author = {
            id: normalizedPost.author.id || '',
            name: normalizedPost.author.name || 'Unknown User',
            avatar: normalizedPost.author.avatar || null
        };
        
        return normalizedPost;
    },
    
    /**
     * 接続テスト
     */
    async testConnection() {
        try {
            const response = await fetch(this.config.apiUrl, {
                method: 'OPTIONS',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            return response.ok;
        } catch (error) {
            console.error('接続テスト失敗:', error);
            return false;
        }
    },
    
    /**
     * エラーのユーザーフレンドリーな変換
     */
    transformError(error) {
        if (typeof error === 'string') {
            return {
                error: {
                    code: 'UNKNOWN_ERROR',
                    message: error,
                    user_message: 'エラーが発生しました。'
                }
            };
        }
        
        if (error && error.error) {
            return error;
        }
        
        if (error && error.message) {
            return {
                error: {
                    code: 'UNKNOWN_ERROR',
                    message: error.message,
                    user_message: 'エラーが発生しました。'
                }
            };
        }
        
        return {
            error: {
                code: 'UNKNOWN_ERROR',
                message: 'Unknown error',
                user_message: '予期しないエラーが発生しました。'
            }
        };
    },
    
    /**
     * リクエスト統計（デバッグ用）
     */
    stats: {
        requests: 0,
        successes: 0,
        errors: 0,
        retries: 0,
        
        record(type) {
            this[type]++;
        },
        
        get() {
            return {
                requests: this.requests,
                successes: this.successes,
                errors: this.errors,
                retries: this.retries,
                successRate: this.requests > 0 ? (this.successes / this.requests * 100).toFixed(2) : 0
            };
        },
        
        reset() {
            this.requests = 0;
            this.successes = 0;
            this.errors = 0;
            this.retries = 0;
        }
    }
};

// グローバルに公開
window.ApiClient = ApiClient;
