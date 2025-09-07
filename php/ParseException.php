<?php

/**
 * データ解析時の例外
 * JSON解析エラー、ActivityPub仕様違反などに使用
 */
class ParseException extends Exception 
{
    /**
     * エラーコードの定数定義
     */
    const JSON_ERROR = 'JSON_ERROR';
    const INVALID_ACTOR = 'INVALID_ACTOR';
    const NO_OUTBOX = 'NO_OUTBOX';
    const INVALID_NOTE = 'INVALID_NOTE';
    
    private string $errorCode;
    
    public function __construct(string $message, string $errorCode = self::JSON_ERROR, Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->errorCode = $errorCode;
    }
    
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
