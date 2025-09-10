package main

import (
	"io"
	"os"

	"github.com/goccy/go-yaml"
)

type BaseSection struct {
	Enabled bool `yaml:"enabled"`
}
type Config struct {
	TemplateName string `yaml:"template_name"`
	AccentColor  string `yaml:"accent_color"`

	Contact    BaseSection `yaml:"contact"`
	Summary    BaseSection `yaml:"summary"`
	Skills     BaseSection `yaml:"skills"`
	Experience BaseSection `yaml:"experience"`
	Education  BaseSection `yaml:"education"`
	Projects   BaseSection `yaml:"projects"`
	Awards     BaseSection `yaml:"awards"`
}

func LoadConfig() (*Config, error) {
	// load config.yml file
	file, err := os.Open("config.yml")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}

	cfg := Config{}
	if err := yaml.Unmarshal(bytes, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
