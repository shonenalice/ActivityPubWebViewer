/**
 * PostRenderer - 投稿表示
 * 投稿データのDOM生成と表示を担当
 */

const PostRenderer = {
    elements: {
        resultsSection: null,
        actorInfo: null,
        postsContainer: null
    },
    
    /**
     * 初期化
     */
    init() {
        this.elements.resultsSection = document.getElementById('results-section');
        this.elements.actorInfo = document.getElementById('actor-info');
        this.elements.postsContainer = document.getElementById('posts-container');
        
        if (!this.elements.resultsSection || !this.elements.postsContainer) {
            console.warn('PostRenderer: 必要な要素が見つかりません');
        }
        
        console.log('PostRenderer 初期化完了');
    },
    
    /**
     * データのレンダリング
     */
    render(data) {
        if (!data) {
            console.error('PostRenderer: データが空です');
            return;
        }
        
        try {
            // Actor情報の表示
            if (data.actor_info) {
                this.renderActorInfo(data.actor_info);
            }
            
            // 投稿一覧の表示
            if (data.posts && Array.isArray(data.posts)) {
                this.renderPosts(data.posts);
            }
            
            // 結果セクションを表示
            this.showResults();
            
            console.log('レンダリング完了:', {
                actor: data.actor_info?.name || 'Unknown',
                posts: data.posts?.length || 0
            });
            
        } catch (error) {
            console.error('レンダリングエラー:', error);
            throw error;
        }
    },
    
    /**
     * Actor情報のレンダリング
     */
    renderActorInfo(actorInfo) {
        if (!this.elements.actorInfo) return;
        
        const avatar = actorInfo.avatar 
            ? `<img src="${AppUtils.escapeHtml(actorInfo.avatar)}" alt="${AppUtils.escapeHtml(actorInfo.name)}のアバター" class="actor-avatar">`
            : `<div class="actor-avatar-placeholder" style="width: 64px; height: 64px; background: #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem;">👤</div>`;
        
        const name = AppUtils.escapeHtml(actorInfo.name || 'Unknown User');
        const username = actorInfo.preferredUsername 
            ? `@${AppUtils.escapeHtml(actorInfo.preferredUsername)}`
            : '';
        const summary = actorInfo.summary 
            ? `<p class="actor-summary">${AppUtils.escapeHtml(actorInfo.summary)}</p>`
            : '';
        
        const followersCount = this.formatCount(actorInfo.followers_count);
        const followingCount = this.formatCount(actorInfo.following_count);
        
        const html = `
            <div class="actor-profile">
                ${avatar}
                <div class="actor-details">
                    <h2>${name}</h2>
                    <p class="actor-username">${username}</p>
                    ${summary}
                    <div class="actor-stats">
                        <span>フォロワー: ${followersCount}</span>
                        <span>フォロー: ${followingCount}</span>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.actorInfo.innerHTML = html;
    },
    
    /**
     * 投稿一覧のレンダリング
     */
    renderPosts(posts) {
        if (!this.elements.postsContainer) return;
        
        if (posts.length === 0) {
            this.elements.postsContainer.innerHTML = `
                <div class="no-posts" style="text-align: center; padding: 2rem; color: #666;">
                    <p>投稿が見つかりませんでした。</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        posts.forEach((post, index) => {
            html += this.renderPost(post, index);
        });
        
        this.elements.postsContainer.innerHTML = html;
        
        // 画像の遅延読み込み設定
        this.setupLazyLoading();
    },
    
    /**
     * 単一投稿のレンダリング
     */
    renderPost(post, index) {
        const avatar = post.author?.avatar 
            ? `<img src="${AppUtils.escapeHtml(post.author.avatar)}" alt="${AppUtils.escapeHtml(post.author.name)}のアバター" class="post-avatar">`
            : `<div class="post-avatar-placeholder" style="width: 40px; height: 40px; background: #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem;">👤</div>`;
        
        const authorName = AppUtils.escapeHtml(post.author?.name || 'Unknown User');
        const formattedDate = post.formatted_date || AppUtils.formatDate(post.published_at);
        const relativeTime = AppUtils.getRelativeTime(post.published_at);
        
        const content = this.processContent(post.content || '');
        const attachments = this.renderAttachments(post.attachments || []);
        
        const postLink = post.url 
            ? `<a href="${AppUtils.escapeHtml(post.url)}" target="_blank" rel="noopener" class="post-link">元の投稿を見る</a>`
            : '';
        
        return `
            <article class="post-item" data-post-id="${AppUtils.escapeHtml(post.id)}" data-index="${index}">
                <header class="post-header">
                    ${avatar}
                    <div class="post-meta">
                        <h4>${authorName}</h4>
                        <time datetime="${post.published_at}" title="${formattedDate}" class="post-date">
                            ${relativeTime}
                        </time>
                    </div>
                </header>
                
                <div class="post-content">
                    ${content}
                </div>
                
                ${attachments}
                
                <footer class="post-actions">
                    ${postLink}
                </footer>
            </article>
        `;
    },
    
    /**
     * 投稿内容の処理
     */
    processContent(content) {
        if (!content || content.trim() === '') {
            return '<p class="empty-content" style="color: #999; font-style: italic;">内容がありません</p>';
        }
        
        // HTMLタグが含まれている場合はそのまま表示（サニタイズ済み）
        if (content.includes('<')) {
            return `<div class="content-html">${content}</div>`;
        }
        
        // プレーンテキストの場合は段落に変換
        return `<p>${AppUtils.escapeHtml(content)}</p>`;
    },
    
    /**
     * 添付ファイルのレンダリング
     */
    renderAttachments(attachments) {
        if (!attachments || attachments.length === 0) {
            return '';
        }
        
        let html = '<div class="post-attachments">';
        
        attachments.forEach((attachment, index) => {
            if (attachment.type === 'image' && attachment.url) {
                const altText = attachment.alt_text || '添付画像';
                html += `
                    <img 
                        src="${AppUtils.escapeHtml(attachment.url)}" 
                        alt="${AppUtils.escapeHtml(altText)}"
                        class="attachment-image"
                        loading="lazy"
                        style="max-width: ${AppUtils.getConfig('display.maxImageWidth', 600)}px;"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                    >
                    <div class="image-error" style="display: none; background: #f0f0f0; padding: 1rem; border-radius: 4px; color: #666;">
                        画像を読み込めませんでした
                    </div>
                `;
            } else if (attachment.url) {
                // その他のファイル形式
                html += `
                    <div class="attachment-file">
                        <a href="${AppUtils.escapeHtml(attachment.url)}" target="_blank" rel="noopener" class="attachment-link">
                            📎 ${AppUtils.escapeHtml(attachment.alt_text || 'ファイル')}
                        </a>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        return html;
    },
    
    /**
     * 数値のフォーマット
     */
    formatCount(count) {
        if (typeof count !== 'number') return '0';
        
        if (count >= 1000000) {
            return Math.floor(count / 1000000) + 'M';
        } else if (count >= 1000) {
            return Math.floor(count / 1000) + 'k';
        }
        
        return count.toString();
    },
    
    /**
     * 画像の遅延読み込み設定
     */
    setupLazyLoading() {
        if (!('IntersectionObserver' in window)) {
            // IntersectionObserver未対応の場合は通常読み込み
            return;
        }
        
        const images = this.elements.postsContainer.querySelectorAll('img[loading="lazy"]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.loading = 'eager';
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    },
    
    /**
     * 結果セクションの表示
     */
    showResults() {
        // 他のセクションを非表示
        const sectionsToHide = [
            'loading-section',
            'error-section'
        ];
        
        sectionsToHide.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                AppUtils.toggleElement(section, false);
            }
        });
        
        // 結果セクションを表示
        if (this.elements.resultsSection) {
            AppUtils.toggleElement(this.elements.resultsSection, true);
            
            // スクロール位置を調整
            this.elements.resultsSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    },
    
    /**
     * 結果のクリア
     */
    clear() {
        if (this.elements.actorInfo) {
            this.elements.actorInfo.innerHTML = '';
        }
        
        if (this.elements.postsContainer) {
            this.elements.postsContainer.innerHTML = '';
        }
        
        if (this.elements.resultsSection) {
            AppUtils.toggleElement(this.elements.resultsSection, false);
        }
    },
    
    /**
     * 投稿数の取得
     */
    getPostCount() {
        if (!this.elements.postsContainer) return 0;
        return this.elements.postsContainer.querySelectorAll('.post-item').length;
    },
    
    /**
     * 特定投稿の取得
     */
    getPost(index) {
        if (!this.elements.postsContainer) return null;
        const postElement = this.elements.postsContainer.querySelector(`[data-index="${index}"]`);
        return postElement || null;
    }
};

// グローバルに公開
window.PostRenderer = PostRenderer;
