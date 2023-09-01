import namehash from 'eth-ens-namehash'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy, fetchIfDifferent } = deployments
  const { deployer, owner } = await getNamedAccounts()
  const [_deployer, _whale] = await ethers.getSigners()

  await _whale.sendTransaction({
    to: _deployer.address,
    value: ethers.utils.parseEther('1.0'),
  })
  console.log('Account balance:', (await _deployer.getBalance()).toString())

  const registry = await deployments.get('ENSRegistry')
  const registryContract = await ethers.getContractAt(
    registry.abi,
    registry.address,
  )

  const baseRegistrar = await deployments.get('BaseRegistrarImplementation')
  const baseRegistrarContract = await ethers.getContractAt(
    baseRegistrar.abi,
    baseRegistrar.address,
  )
  const remiliasHash = namehash.hash('remilias.eth')
  const deployArgs = {
    from: deployer,
    args: [registry.address, remiliasHash],
    log: true,
  }

  await deploy('RemiliasRegistrar', deployArgs)
  const _remiliasRegistrar = await deployments.get('RemiliasRegistrar')
  const remiliasRegistrar = await ethers.getContractAt(
    _remiliasRegistrar.abi,
    _remiliasRegistrar.address,
  )

  const isController = await remiliasRegistrar.controllers(owner)
  if (!isController) {
    const tx = await remiliasRegistrar.addController(owner)
    console.log(`Adding owner as controller on registrar (tx: ${tx.hash})...`)
    await tx.wait()
  }

  const ethHash = namehash.hash('eth')
  const nodeHash = namehash.hash('remilias.eth')
  const nodeOwner = await registryContract.owner(nodeHash)

  // if (nodeOwner !== owner) {
  //   const tx2 = await registryContract.setSubnodeOwner(
  //     ethHash,
  //     '0x' + keccak256('remilias'),
  //     owner,
  //   )
  //   console.log(
  //     `Setting owner of remilias.eth node to owner (tx: ${tx2.hash})...`,
  //   )
  //   await tx2.wait()
  // }

  if (nodeOwner !== remiliasRegistrar.address) {
    let RemiliasResolver
    try {
      RemiliasResolver = await deployments.get('RemiliasResolver')
      if (RemiliasResolver) {
        const nodeResolver = await registryContract.resolver(remiliasHash)
        if (nodeResolver === RemiliasResolver.address) {
          const tx2 = await registryContract.setOwner(
            nodeHash,
            remiliasRegistrar.address,
          )
          console.log(
            `Setting owner of remilias.eth node to RemiliasRegistrar (tx: ${tx2.hash})...`,
          )
          await tx2.wait()
        }
      }
    } catch (error) {}
  }
  if (owner !== deployer) {
    const tx1 = await remiliasRegistrar.transferOwnership(owner)
    console.log(
      `Transferring ownership of registrar to owner (tx: ${tx1.hash})...`,
    )
    await tx1.wait()
  }
}

func.id = 'registrar'
func.tags = ['remiliasregistrar', 'RemiliasRegistrar']
func.dependencies = []

export default func
