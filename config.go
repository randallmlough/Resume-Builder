package main

import (
	"io"
	"os"

	"github.com/goccy/go-yaml"
)

type BaseSection struct {
	Hide bool `yaml:"hide"`
}
type Config struct {
	TemplateName string `yaml:"template_name"`
	AccentColor  string `yaml:"accent_color"`
	MutedColor   string `yaml:"muted_color"`
	FontSans     string `yaml:"font_sans"`
	FontSerif    string `yaml:"font_serif"`

	Contact    BaseSection `yaml:"contact"`
	Summary    BaseSection `yaml:"summary"`
	Skills     BaseSection `yaml:"skills"`
	Experience Experience  `yaml:"experience"`
	Education  BaseSection `yaml:"education"`
	Projects   BaseSection `yaml:"projects"`
	Awards     BaseSection `yaml:"awards"`
}

type Experience struct {
	BaseSection
	HideOverview     bool `yaml:"hide_overview"`
	HideLocation     bool `yaml:"hide_location"`
	HideDate         bool `yaml:"hide_date"`
	HideTechnologies bool `yaml:"hide_technologies"`
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
