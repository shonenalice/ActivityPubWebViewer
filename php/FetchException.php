<?php

/**
 * データ取得時の例外
 * ネットワークエラー、HTTPエラー、タイムアウトなどに使用
 */
class FetchException extends Exception 
{
    /**
     * エラーコードの定数定義
     */
    const NETWORK_ERROR = 'NETWORK_ERROR';
    const HTTP_ERROR = 'HTTP_ERROR';
    const TIMEOUT_ERROR = 'TIMEOUT_ERROR';
    const INVALID_URL = 'INVALID_URL';
    const DOMAIN_NOT_ALLOWED = 'DOMAIN_NOT_ALLOWED';
    
    private string $errorCode;
    
    public function __construct(string $message, string $errorCode = self::NETWORK_ERROR, Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->errorCode = $errorCode;
    }
    
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
