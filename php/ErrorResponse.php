<?php

/**
 * エラーレスポンス管理クラス
 * 統一されたエラーレスポンス形式を提供
 */
class ErrorResponse
{
    /**
     * エラーメッセージマッピング
     */
    private static array $errorMessages = [
        // URL関連エラー
        'INVALID_URL' => [
            'message' => 'Invalid URL format',
            'user_message' => 'URLの形式が正しくありません。HTTPSのURLを入力してください。'
        ],
        'DOMAIN_NOT_ALLOWED' => [
            'message' => 'Domain not allowed',
            'user_message' => '許可されていないドメインです。'
        ],
        
        // ネットワーク関連エラー
        'NETWORK_ERROR' => [
            'message' => 'Network connection failed',
            'user_message' => 'ネットワーク接続に失敗しました。しばらく時間をおいてから再試行してください。'
        ],
        'HTTP_ERROR' => [
            'message' => 'HTTP request failed',
            'user_message' => 'データの取得に失敗しました。URLが正しいか確認してください。'
        ],
        'TIMEOUT_ERROR' => [
            'message' => 'Request timeout',
            'user_message' => '応答時間が長すぎます。しばらく時間をおいてから再試行してください。'
        ],
        
        // データ解析関連エラー
        'JSON_ERROR' => [
            'message' => 'JSON parsing failed',
            'user_message' => 'データの解析に失敗しました。'
        ],
        'INVALID_ACTOR' => [
            'message' => 'Invalid ActivityPub Actor',
            'user_message' => '有効なActivityPubユーザーではありません。'
        ],
        'NO_OUTBOX' => [
            'message' => 'Outbox not found',
            'user_message' => '投稿データが見つかりません。'
        ],
        'INVALID_NOTE' => [
            'message' => 'Invalid Note object',
            'user_message' => '投稿データの形式が正しくありません。'
        ],
        
        // 一般的なエラー
        'UNKNOWN_ERROR' => [
            'message' => 'Unknown error occurred',
            'user_message' => '予期しないエラーが発生しました。'
        ]
    ];

    /**
     * エラーレスポンスを生成して出力
     *
     * @param string $errorCode
     * @param string|null $customMessage
     * @param int $httpCode
     * @return void
     */
    public static function output(string $errorCode, ?string $customMessage = null, int $httpCode = 400): void
    {
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=utf-8');
        
        $errorInfo = self::$errorMessages[$errorCode] ?? self::$errorMessages['UNKNOWN_ERROR'];
        
        $response = [
            'success' => false,
            'error' => [
                'code' => $errorCode,
                'message' => $customMessage ?? $errorInfo['message'],
                'user_message' => $errorInfo['user_message'],
                'timestamp' => date('c')
            ]
        ];
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * 例外からエラーレスポンスを生成
     *
     * @param Exception $exception
     * @return void
     */
    public static function fromException(Exception $exception): void
    {
        $errorCode = 'UNKNOWN_ERROR';
        $httpCode = 500;
        
        if ($exception instanceof FetchException) {
            $errorCode = $exception->getErrorCode();
            $httpCode = 400;
        } elseif ($exception instanceof ParseException) {
            $errorCode = $exception->getErrorCode();
            $httpCode = 400;
        }
        
        self::output($errorCode, $exception->getMessage(), $httpCode);
    }

    /**
     * 成功レスポンスを生成して出力
     *
     * @param array $data
     * @return void
     */
    public static function success(array $data): void
    {
        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        
        $response = [
            'success' => true,
            'data' => $data
        ];
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
}
