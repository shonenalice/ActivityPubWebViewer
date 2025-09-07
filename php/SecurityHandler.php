<?php

/**
 * セキュリティ処理クラス
 * CORS、入力検証、出力エスケープなどのセキュリティ機能を提供
 */
class SecurityHandler
{
    /**
     * CORS ヘッダーを設定
     *
     * @param string $allowedOrigin 許可するオリジン（デフォルト: 同一オリジン）
     * @return void
     */
    public static function setCorsHeaders(string $allowedOrigin = '*'): void
    {
        // 本番環境では具体的なドメインを指定することを推奨
        header("Access-Control-Allow-Origin: {$allowedOrigin}");
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept');
        header('Access-Control-Max-Age: 86400'); // 24時間
        
        // OPTIONSリクエスト（プリフライト）への対応
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }

    /**
     * コンテンツのHTMLサニタイズ
     *
     * @param string $content
     * @return string
     */
    public static function sanitizeHtml(string $content): string
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
     * JSON入力データの検証とサニタイズ
     *
     * @param string $jsonInput
     * @return array
     * @throws ParseException
     */
    public static function validateJsonInput(string $jsonInput): array
    {
        // JSON形式の検証
        $data = json_decode($jsonInput, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new ParseException('不正なJSON形式です: ' . json_last_error_msg(), ParseException::JSON_ERROR);
        }
        
        // 必須フィールドの確認
        if (!isset($data['action']) || !isset($data['actor_url'])) {
            throw new ParseException('必須フィールドが不足しています。', ParseException::JSON_ERROR);
        }
        
        // actionの値を検証
        if ($data['action'] !== 'fetch_posts') {
            throw new ParseException('サポートされていないアクションです。', ParseException::JSON_ERROR);
        }
        
        // actor_urlの基本的な検証
        if (!is_string($data['actor_url']) || empty(trim($data['actor_url']))) {
            throw new ParseException('有効なactor_urlが必要です。', ParseException::JSON_ERROR);
        }
        
        return $data;
    }

    /**
     * エラーレスポンスの安全な出力
     *
     * @param string $errorCode
     * @param string $message
     * @param string $userMessage
     * @param int $httpCode
     * @return void
     */
    public static function outputError(string $errorCode, string $message, string $userMessage, int $httpCode = 400): void
    {
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=utf-8');
        
        $response = [
            'success' => false,
            'error' => [
                'code' => $errorCode,
                'message' => self::sanitizeForOutput($message),
                'user_message' => self::sanitizeForOutput($userMessage),
                'timestamp' => date('c')
            ]
        ];
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * 出力用の文字列サニタイズ
     *
     * @param string $text
     * @return string
     */
    private static function sanitizeForOutput(string $text): string
    {
        // XSS対策のための基本的なエスケープ
        return htmlspecialchars($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * セキュアなHTTPヘッダーの設定
     *
     * @return void
     */
    public static function setSecurityHeaders(): void
    {
        // XSS対策
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        
        // HTTPS強制（本番環境用）
        if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
        
        // コンテンツタイプの明示
        header('Content-Type: application/json; charset=utf-8');
    }
}
