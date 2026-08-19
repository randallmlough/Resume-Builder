package config

import (
	"testing"

	"github.com/goccy/go-yaml"
)

func TestPageMarkerConfigUnmarshal(t *testing.T) {
	input := []byte("page_marker:\n  hide: true\n")

	var cfg Config
	if err := yaml.Unmarshal(input, &cfg); err != nil {
		t.Fatalf("expected config to unmarshal, got error: %v", err)
	}

	if !cfg.PageMarker.Hide {
		t.Error("expected page marker to be hidden")
	}
}
