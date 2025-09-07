<?php

/**
 * 投稿（Note）のデータを保持するエンティティクラス
 * ActivityStreams 2.0 Vocabularyで定義される`Note`タイプのオブジェクトに対応
 */
class Note
{
    public readonly string $id;
    public readonly string $content;
    public readonly string $sanitizedContent;
    public readonly DateTimeImmutable $publishedAt;
    public readonly string $formattedDate;
    public readonly ?string $url;
    public readonly array $attachments;
    public readonly array $author;

    /**
     * コンストラクタ
     */
    private function __construct(
        string $id, 
        string $content, 
        string $sanitizedContent,
        DateTimeImmutable $publishedAt, 
        string $formattedDate,
        ?string $url, 
        array $attachments,
        array $author
    ) {
        $this->id = $id;
        $this->content = $content;
        $this->sanitizedContent = $sanitizedContent;
        $this->publishedAt = $publishedAt;
        $this->formattedDate = $formattedDate;
        $this->url = $url;
        $this->attachments = $attachments;
        $this->author = $author;
    }

    /**
     * ActivityStreamsの配列からNoteオブジェクトを生成するファクトリメソッド
     *
     * @param array $data NoteタイプのActivityStreamsオブジェクト
     * @return self
     */
    public static function fromArray(array $data): self
    {
        // 投稿日時の処理
        $publishedAt = new DateTimeImmutable($data['published'] ?? 'now');
        $formattedDate = $publishedAt->setTimezone(new DateTimeZone('Asia/Tokyo'))
                                   ->format('Y年m月d日 H:i');

        // 添付ファイルのURLを抽出
        $attachments = [];
        if (isset($data['attachment']) && is_array($data['attachment'])) {
            foreach ($data['attachment'] as $att) {
                if (isset($att['type'], $att['url'])) {
                    $attachment = [
                        'type' => strtolower($att['type']),
                        'url' => $att['url'],
                        'alt_text' => $att['name'] ?? ''
                    ];
                    
                    // 画像の場合は追加情報を含める
                    if ($attachment['type'] === 'image') {
                        $attachment['width'] = $att['width'] ?? null;
                        $attachment['height'] = $att['height'] ?? null;
                    }
                    
                    $attachments[] = $attachment;
                }
            }
        }

        // 投稿者情報の抽出
        $author = [];
        if (isset($data['attributedTo'])) {
            // attributedToがURLの場合は簡易情報のみ
            if (is_string($data['attributedTo'])) {
                $author = [
                    'id' => $data['attributedTo'],
                    'name' => 'Unknown User',
                    'avatar' => null
                ];
            } elseif (is_array($data['attributedTo'])) {
                $author = [
                    'id' => $data['attributedTo']['id'] ?? '',
                    'name' => $data['attributedTo']['name'] ?? $data['attributedTo']['preferredUsername'] ?? 'Unknown User',
                    'avatar' => $data['attributedTo']['icon']['url'] ?? null
                ];
            }
        }

        // コンテンツのサニタイズ
        $originalContent = $data['content'] ?? '';
        $sanitizedContent = self::sanitizeContent($originalContent);

        return new self(
            id: $data['id'] ?? '',
            content: $originalContent,
            sanitizedContent: $sanitizedContent,
            publishedAt: $publishedAt,
            formattedDate: $formattedDate,
            url: $data['url'] ?? null,
            attachments: $attachments,
            author: $author
        );
    }

    /**
     * コンテンツのサニタイズ処理
     *
     * @param string $content
     * @return string
     */
    private static function sanitizeContent(string $content): string
    {
        // 許可するHTMLタグ
        $allowedTags = '<p><br><a><strong><em><b><i><u><s><code><pre><blockquote><ul><ol><li>';
        
        // HTMLタグのフィルタリング
        $sanitized = strip_tags($content, $allowedTags);
        
        // 特殊文字のエスケープ（ただし既に許可されたHTMLタグは保持）
        $sanitized = htmlspecialchars($sanitized, ENT_QUOTES | ENT_HTML5, 'UTF-8', false);
        
        // 長さ制限（10000文字）
        if (mb_strlen($sanitized) > 10000) {
            $sanitized = mb_substr($sanitized, 0, 10000) . '...';
        }
        
        return $sanitized;
    }

    /**
     * JSON形式での出力用配列を生成
     *
     * @return array
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'content' => $this->sanitizedContent,
            'published_at' => $this->publishedAt->format('c'),
            'formatted_date' => $this->formattedDate,
            'url' => $this->url,
            'attachments' => $this->attachments,
            'author' => $this->author
        ];
    }
}
