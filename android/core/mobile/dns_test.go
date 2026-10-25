// SPDX-License-Identifier: GPL-3.0-or-later
package mobile

import (
	"bytes"
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestEncryptedDNSFallsBackAfterProviderTimeout(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	want := make([]byte, 12)
	want[0] = 42
	var calls atomic.Int32
	var first context.Context
	ready := make(chan struct{})
	result, err := exchangeEncryptedDNS(ctx, []string{"stalled", "healthy"}, 100*time.Millisecond, func(attempt context.Context, provider string) ([]byte, error) {
		calls.Add(1)
		if provider == "stalled" {
			first = attempt
			close(ready)
			<-attempt.Done()
			return nil, attempt.Err()
		}
		<-ready
		if attempt.Err() != nil || ctx.Err() != nil {
			t.Fatal("the stalled provider must not consume the fallback's deadline")
		}
		return want, nil
	})
	if err != nil || calls.Load() != 2 || !bytes.Equal(result, want) {
		t.Fatalf("fallback result=%v calls=%d err=%v", result, calls.Load(), err)
	}
	if first.Err() == nil {
		t.Fatal("Unused DNS attempts were not canceled")
	}
}

func TestEncryptedDNSRejectsInvalidResponsesAndHonorsCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var calls atomic.Int32
	_, err := exchangeEncryptedDNS(ctx, []string{"short", "oversized", "failed"}, time.Second, func(attempt context.Context, provider string) ([]byte, error) {
		calls.Add(1)
		switch provider {
		case "short":
			return []byte{0}, nil
		case "oversized":
			return make([]byte, 4097), nil
		default:
			cancel()
			return nil, context.Canceled
		}
	})
	if calls.Load() != 3 || !errors.Is(err, context.Canceled) {
		t.Fatalf("calls=%d err=%v", calls.Load(), err)
	}
	_, err = exchangeEncryptedDNS(ctx, []string{"unused"}, time.Second, func(context.Context, string) ([]byte, error) {
		t.Fatal("a canceled lookup must not start another request")
		return nil, nil
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
