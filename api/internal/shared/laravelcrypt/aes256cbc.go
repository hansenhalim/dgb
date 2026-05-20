package laravelcrypt

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

// AES256CBC implements the same envelope format as Laravel's default
// `Crypt::encrypt` (cipher = aes-256-cbc, with encrypt-then-MAC). The
// output bytes are the ASCII of the standard Laravel payload:
//
//	base64( json{ iv: base64(IV), value: base64(ciphertext), mac: hex(hmac), tag: "" } )
//
// Plaintext is PHP-serialized as a string (`s:<len>:"<bytes>";`) before
// encryption, so `Crypt::decrypt` on the Laravel side returns the original
// bytes via its built-in `unserialize` step.
type AES256CBC struct {
	key []byte // 32 bytes
}

// New parses a Laravel-style APP_KEY value (e.g. "base64:<base64-32-bytes>"
// or a raw 32-byte string) and returns an encryptor.
func New(appKey string) (*AES256CBC, error) {
	key, err := decodeAppKey(appKey)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("APP_KEY must decode to 32 bytes, got %d", len(key))
	}
	return &AES256CBC{key: key}, nil
}

func decodeAppKey(v string) ([]byte, error) {
	if rest, ok := strings.CutPrefix(v, "base64:"); ok {
		return base64.StdEncoding.DecodeString(rest)
	}
	return []byte(v), nil
}

func (e *AES256CBC) Encrypt(plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, err
	}

	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		return nil, err
	}

	padded := pkcs7Pad(phpSerializeString(plaintext), aes.BlockSize)
	ciphertext := make([]byte, len(padded))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, padded)

	ivB64 := base64.StdEncoding.EncodeToString(iv)
	valueB64 := base64.StdEncoding.EncodeToString(ciphertext)

	mac := hmac.New(sha256.New, e.key)
	mac.Write([]byte(ivB64))
	mac.Write([]byte(valueB64))
	macHex := hex.EncodeToString(mac.Sum(nil))

	payload, err := json.Marshal(map[string]string{
		"iv":    ivB64,
		"value": valueB64,
		"mac":   macHex,
		"tag":   "",
	})
	if err != nil {
		return nil, err
	}

	return []byte(base64.StdEncoding.EncodeToString(payload)), nil
}

func pkcs7Pad(in []byte, blockSize int) []byte {
	padLen := blockSize - (len(in) % blockSize)
	pad := bytes.Repeat([]byte{byte(padLen)}, padLen)
	return append(in, pad...)
}

// phpSerializeString mirrors PHP's `serialize($bytes)` for a string value:
// `s:<byte-length>:"<raw-bytes>";`. Length is measured in bytes (not runes)
// and the bytes are embedded verbatim, so binary payloads round-trip.
func phpSerializeString(in []byte) []byte {
	prefix := fmt.Sprintf("s:%d:\"", len(in))
	out := make([]byte, 0, len(prefix)+len(in)+2)
	out = append(out, prefix...)
	out = append(out, in...)
	out = append(out, '"', ';')
	return out
}
