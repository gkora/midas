# MIDAS

MIDAS Website, hosted at http://midas-omicsbio.ornl.gov

A database searching approach can be used for metabolite identification in metabolomics by matching the measured tandem mass spectra against the predicted fragments of metabolites in a database. Here we present the MIDAS algorithm (Metabolite Identification via Database Searching) freely available at http://midas.omicsbio.org. To evaluate a metabolite-spectrum match (MSM), MIDAS first enumerates possible fragments from a metabolite by systematic bond dissociation, then calculates the plausibility of the fragments based on their fragmentation pathways, and finally scores the MSM to reflect how well the metabolite explains the spectrum. MIDAS was designed to search high-resolution tandem mass spectra acquired on time-of-flight or Orbitrap against a large metabolite database in an automated and high-throughput manner.

## Installation
```bash
#Clone the repo from github.
cd midas
npm install
```

## Development

* To monitor and develop
```bash
	cd <development dir>
	./mon
```

## Production

* To start forever

```bash
	cd midas
	./daemon.sh
```

* To stop already started forever process

```bash
	cd midas
	./daemon-stop.sh
```
